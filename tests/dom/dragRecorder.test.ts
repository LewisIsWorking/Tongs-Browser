import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DragRecorder } from '../../src/debug/DragRecorder.js';
import type { DragObservers } from '../../src/debug/DragObservers.js';

/**
 * Watching one drag as it happens.
 *
 * ⚠️ Recording and REPORTING are separate on purpose, and that separation is the lesson of the whole
 * investigation behind this folder. Foundry resets its interaction state the moment a gesture ends,
 * so anything read when the report is written describes the aftermath: the manager says NONE whether
 * the drag never started or ran perfectly and committed.
 *
 * The uncovered branches here were the capture window's edges, which is where every "the report
 * described the wrong moment" bug has come from.
 */
type MutableGlobal = Record<string, unknown>;
const globals = globalThis as unknown as MutableGlobal;

function build() {
  const observers = { attach: vi.fn(), beginDrag: vi.fn() } as unknown as DragObservers;
  let dragging = false;
  const recorder = new DragRecorder({
    window: window,
    isDragging: () => dragging,
    pointerPosition: () => ({ clientX: 100, clientY: 200 }),
    observers,
  });
  return {
    recorder,
    observers,
    setDragging: (value: boolean) => {
      dragging = value;
    },
  };
}

const target = () => {
  const element = document.createElement('canvas');
  element.id = 'board';
  return element;
};

const move = (clientX: number) => ({
  type: 'pointermove',
  buttons: 1,
  position: { clientX, clientY: 200 },
});

beforeEach(() => {
  document.body.innerHTML = '';
  Reflect.deleteProperty(globals, 'canvas');
});

/**
 * ⚠️ THE MOVE COUNT IS A DENOMINATOR, and it decides whether a probe is believed at all.
 *
 * `describeThinly` refuses to state a peak sampled under 10% of the moves sent. The freeze used to
 * sit below this counter, so on a phone the pointer keeps moving for as long as it takes to read the
 * report, the count ran away, and every probe was declared thin. A report of "2 samples of 227 moves"
 * was counting hundreds of moves that happened after the drag it was describing.
 *
 * A measuring instrument that keeps measuring after the event does not report the event.
 */
describe('counting the moves a report is measured against', () => {
  it('counts moves that happen during the drag', () => {
    const { recorder, setDragging } = build();
    setDragging(true);
    recorder.recordDispatch({ type: 'pointerdown', buttons: 1 }, target());

    recorder.recordDispatch(move(110), target());
    recorder.recordDispatch(move(120), target());

    expect(recorder.sampler.snapshot().movesDispatched).toBe(2);
  });

  /**
   * ⚠️ THIS is the case that proves the `isCapturing` guard, and the first version of this suite
   * missed it. After a drop the capture window freezes and `recordDispatch` returns early, so moves
   * are not counted whether the guard exists or not - deleting it left every test passing.
   *
   * A move with no drag ever started reaches the counter with nothing frozen, which is the only path
   * where the guard is load bearing. On a phone the pointer moves constantly between gestures, so
   * without it the denominator counts the whole session.
   */
  it('does not count moves when no drag has ever started', () => {
    const { recorder } = build();

    recorder.recordDispatch(move(110), target());
    recorder.recordDispatch(move(120), target());
    recorder.recordDispatch(move(130), target());

    expect(recorder.sampler.snapshot().movesDispatched).toBe(0);
  });

  it('stops counting once the drag has ended, so the denominator cannot run away', () => {
    const { recorder, setDragging } = build();
    setDragging(true);
    recorder.recordDispatch({ type: 'pointerdown', buttons: 1 }, target());
    recorder.recordDispatch(move(110), target());

    setDragging(false);
    recorder.recordDispatch({ type: 'pointerup', buttons: 0 }, target());
    for (const x of [130, 140, 150, 160]) {
      recorder.recordDispatch(move(x), target());
    }

    expect(recorder.sampler.snapshot().movesDispatched).toBe(1);
  });
});

/**
 * ⚠️ A trace showing no pointermove has two completely different causes: the finger produced no
 * gesture input at all, or it did and the gesture layer chose not to move the pointer. Counting the
 * raw touch separates them, and nothing else in the report can.
 */
describe('counting the raw touch behind the events', () => {
  it('counts each input type separately', () => {
    const { recorder } = build();

    recorder.countGestureInput('touchmove');
    recorder.countGestureInput('touchmove');
    recorder.countGestureInput('touchend');

    expect(recorder.gestureInputCounts['touchmove']).toBe(2);
    expect(recorder.gestureInputCounts['touchend']).toBe(1);
  });

  /** Cumulative on purpose: it answers "did the finger do anything at all this session". */
  it('keeps counting across drags rather than resetting', () => {
    const { recorder, setDragging } = build();
    recorder.countGestureInput('touchmove');

    setDragging(true);
    recorder.recordDispatch({ type: 'pointerdown', buttons: 1 }, target());

    expect(recorder.gestureInputCounts['touchmove']).toBe(1);
  });
});

/**
 * ⚠️ The token position at the grab is the point of the record. Every other field answers a question
 * about EVENTS; comparing this against the position now says outright whether the gesture achieved
 * anything, which is the only thing anyone actually cares about.
 */
describe('what a fresh drag record captures', () => {
  it('remembers where the token was when the grab began', () => {
    globals['canvas'] = { tokens: { controlled: [{ document: { x: 600, y: 700 } }] } };
    const { recorder, setDragging } = build();

    setDragging(true);
    recorder.recordDispatch({ type: 'pointerdown', buttons: 1 }, target());

    expect(recorder.tokenAtGrab).toEqual({ x: 600, y: 700 });
  });

  it('records no position when nothing is controlled, rather than a misleading zero', () => {
    globals['canvas'] = { tokens: { controlled: [] } };
    const { recorder, setDragging } = build();

    setDragging(true);
    recorder.recordDispatch({ type: 'pointerdown', buttons: 1 }, target());

    expect(recorder.tokenAtGrab).toBeNull();
  });

  it('tells the observers a new drag has opened, so their counters reset too', () => {
    const { recorder, observers, setDragging } = build();

    setDragging(true);
    recorder.recordDispatch({ type: 'pointerdown', buttons: 1 }, target());

    expect(observers.beginDrag).toHaveBeenCalledTimes(1);
  });
});

describe('reporting whether the token actually moved', () => {
  it('compares the grab position against where it is now', () => {
    globals['canvas'] = { tokens: { controlled: [{ document: { x: 600, y: 700 } }] } };
    const { recorder, setDragging } = build();
    setDragging(true);
    recorder.recordDispatch({ type: 'pointerdown', buttons: 1 }, target());

    globals['canvas'] = { tokens: { controlled: [{ document: { x: 800, y: 700 } }] } };

    expect(recorder.describeTokenMovement().verdict).toBe('moved');
  });

  it('says it did not move when the position is unchanged', () => {
    globals['canvas'] = { tokens: { controlled: [{ document: { x: 600, y: 700 } }] } };
    const { recorder, setDragging } = build();
    setDragging(true);
    recorder.recordDispatch({ type: 'pointerdown', buttons: 1 }, target());

    expect(recorder.describeTokenMovement().verdict).toBe('unmoved');
  });
});
