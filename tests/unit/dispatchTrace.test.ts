import { describe, expect, it } from 'vitest';

import { DISPATCH_TRACE_LENGTH, DispatchTrace } from '../../src/debug/DispatchTrace.js';

/**
 * The ring buffer behind the dispatch trace.
 *
 * Its one piece of real behaviour, collapsing repeats, exists because of a measured failure rather
 * than tidiness: a held pointer that is not moving emits the same line hundreds of times, the buffer
 * is eighteen entries long, and a moment of stillness at the end of a gesture therefore erased the
 * whole gesture before it. A device produced a trace describing only the pause.
 */
const move = (clientX: number, clientY: number, buttons = 1) => ({
  type: 'pointermove',
  buttons,
  position: { clientX, clientY },
});

describe('DispatchTrace', () => {
  it('records the type, buttons, position and target', () => {
    const trace = new DispatchTrace();

    trace.record(move(10.4, 20.6), 'canvas#board');

    expect(trace.getLines()).toEqual(['pointermove buttons=1 @10,21 -> canvas#board']);
  });

  /**
   * `buttons` is the whole story for dragging: it must stay non zero on every move between the down
   * and the up, or Foundry reads the stream as a hover. A zero here while a grab is held names that
   * bug outright, so it must be printed rather than defaulted away.
   */
  it('prints buttons=0 rather than hiding it', () => {
    const trace = new DispatchTrace();

    trace.record({ type: 'pointerup', buttons: 0, position: { clientX: 1, clientY: 2 } }, 'div#x');

    expect(trace.getLines()[0]).toContain('buttons=0');
  });

  it('omits the position when an event carries none', () => {
    const trace = new DispatchTrace();

    trace.record({ type: 'click' }, 'canvas#board');

    expect(trace.getLines()).toEqual(['click buttons=0 -> canvas#board']);
  });

  it('collapses a run of identical lines into a count', () => {
    const trace = new DispatchTrace();

    trace.record(move(5, 5), 'canvas#board');
    trace.record(move(5, 5), 'canvas#board');
    trace.record(move(5, 5), 'canvas#board');

    expect(trace.getLines()).toEqual(['pointermove buttons=1 @5,5 -> canvas#board x3']);
  });

  /**
   * The collapse is what stops a pause erasing the gesture. Without it, eighteen identical lines
   * push out everything that came before, which is precisely what a device reported.
   */
  it('keeps the earlier gesture visible through a long pause', () => {
    const trace = new DispatchTrace();

    trace.record(move(0, 0), 'canvas#board');
    for (let index = 0; index < 200; index += 1) {
      trace.record(move(50, 50), 'canvas#board');
    }

    expect(trace.getLines()).toHaveLength(2);
    expect(trace.getLines()[0]).toContain('@0,0');
    expect(trace.getLines()[1]).toContain('x200');
  });

  it('starts a fresh line once the position changes again', () => {
    const trace = new DispatchTrace();

    trace.record(move(5, 5), 'canvas#board');
    trace.record(move(5, 5), 'canvas#board');
    trace.record(move(6, 5), 'canvas#board');

    expect(trace.getLines()).toEqual([
      'pointermove buttons=1 @5,5 -> canvas#board x2',
      'pointermove buttons=1 @6,5 -> canvas#board',
    ]);
  });

  /** A ring buffer, because this records every dispatch for the whole session. */
  it('keeps only the most recent entries', () => {
    const trace = new DispatchTrace(3);

    for (let index = 0; index < 6; index += 1) {
      trace.record(move(index, 0), 'canvas#board');
    }

    expect(trace.getLines()).toHaveLength(3);
    expect(trace.getLines()[0]).toContain('@3,0');
    expect(trace.getLines()[2]).toContain('@5,0');
  });

  it('reports its length and clears', () => {
    const trace = new DispatchTrace();

    trace.record(move(1, 1), 'canvas#board');
    expect(trace.length).toBe(1);

    trace.clear();
    expect(trace.length).toBe(0);
    expect(trace.getLines()).toEqual([]);
  });

  it('defaults to a length a phone chat window can actually show', () => {
    expect(DISPATCH_TRACE_LENGTH).toBe(18);

    const trace = new DispatchTrace();
    for (let index = 0; index < 50; index += 1) {
      trace.record(move(index, 0), 'canvas#board');
    }

    expect(trace.getLines()).toHaveLength(DISPATCH_TRACE_LENGTH);
  });
});
