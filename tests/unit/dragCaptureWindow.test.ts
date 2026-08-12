import { describe, expect, it } from 'vitest';

import {
  DragCaptureWindow,
  isRelease,
  type CaptureVerdict,
} from '../../src/debug/DragCaptureWindow.js';

/**
 * When the drag record is open, and when it must stop listening.
 *
 * Every rule here was learned from a device report that described the wrong moment, so the tests are
 * SEQUENCES rather than single calls: the defects only exist in the ordering.
 */
type Step = readonly [dragging: boolean, type: string];

const play = (window: DragCaptureWindow, steps: readonly Step[]): CaptureVerdict[] =>
  steps.map(([dragging, type]) => window.observe(dragging, type));

/** A grab, some moves, then the release. `endDrag` clears the flag BEFORE dispatching the up. */
const A_DRAG: readonly Step[] = [
  [true, 'pointerdown'],
  [true, 'pointermove'],
  [true, 'pointermove'],
  [false, 'pointerup'],
];

describe('isRelease', () => {
  it('counts both release types, because Foundry acts on either', () => {
    expect(isRelease('pointerup')).toBe(true);
    expect(isRelease('mouseup')).toBe(true);
    expect(isRelease('pointermove')).toBe(false);
    expect(isRelease('pointerdown')).toBe(false);
  });
});

describe('DragCaptureWindow', () => {
  it('opens exactly once, on the event where the drag begins', () => {
    const verdicts = play(new DragCaptureWindow(), A_DRAG);

    expect(verdicts.map((verdict) => verdict.kind)).toEqual([
      'opened',
      'record',
      'record',
      'record',
    ]);
  });

  /**
   * ⚠️ The off by one that hid the single most important event in the trace.
   *
   * `endDrag` clears the dragging flag before dispatching, so at the release the window is already
   * told `dragging: false`. Marking the drop any earlier freezes on the release ITSELF, and every
   * device trace then ended on a `pointermove`, making a released drag look identical to one still
   * held. That is the exact distinction the report exists to draw.
   */
  it('RECORDS the release that ends the drag rather than freezing on it', () => {
    const window = new DragCaptureWindow();

    const verdicts = play(window, A_DRAG);

    expect(verdicts.at(-1)?.kind).toBe('record');
    expect(window.hasSeenDrop()).toBe(true);
  });

  /**
   * ⚠️ The defect this extraction fixed, and it is a measuring instrument measuring the wrong thing.
   *
   * The freeze used to sit below the caller's move counter, so every pointer move AFTER the drop
   * still incremented the denominator while sampling had already stopped. On a phone the pointer
   * keeps moving for as long as it takes to read the report, so a genuine three move drag reported
   * hundreds of moves and every probe was declared too thinly sampled to state.
   */
  it('freezes on the very next event after the drop, so nothing later is counted', () => {
    const window = new DragCaptureWindow();
    play(window, A_DRAG);

    const after = play(window, [
      [false, 'pointermove'],
      [false, 'pointermove'],
      [false, 'click'],
      [false, 'pointermove'],
    ]);

    expect(after.every((verdict) => verdict.kind === 'frozen')).toBe(true);
  });

  /**
   * ⚠️ Resetting on every pointerdown looked obviously right and destroyed the evidence every time. A
   * single tap after a drag wiped the drag out of the buffer, so the report described the tap.
   */
  it('survives a tap after the drag, until that tap presses down', () => {
    const window = new DragCaptureWindow();
    play(window, A_DRAG);

    // Movement afterwards cannot touch the record.
    expect(window.observe(false, 'pointermove').kind).toBe('frozen');
    expect(window.isCapturing()).toBe(true);

    // A deliberate fresh press retires it, which is the one thing that may. It still does not get
    // recorded: the record stays closed until the next GRAB opens a new one.
    expect(window.observe(false, 'pointerdown').kind).toBe('retired');
    expect(window.isCapturing()).toBe(false);
  });

  it('keeps only the recent past when nothing is captured and nothing is dragging', () => {
    const window = new DragCaptureWindow();

    expect(window.observe(false, 'pointermove').kind).toBe('restart');
    expect(window.observe(false, 'pointerdown').kind).toBe('restart');
    expect(window.isCapturing()).toBe(false);
  });

  it('opens a fresh record for a second drag, discarding the first', () => {
    const window = new DragCaptureWindow();
    play(window, A_DRAG);
    expect(window.observe(false, 'pointerdown').kind).toBe('retired');

    const second = play(window, A_DRAG);

    expect(second[0]?.kind).toBe('opened');
    expect(window.hasSeenDrop()).toBe(true);
  });

  /** A second drag straight after the first, with no intervening press, still opens cleanly. */
  it('reopens even when the drop is still marked from the previous drag', () => {
    const window = new DragCaptureWindow();
    play(window, A_DRAG);
    expect(window.hasSeenDrop()).toBe(true);

    expect(window.observe(true, 'pointerdown').kind).toBe('opened');
    expect(window.hasSeenDrop()).toBe(false);
  });

  it('treats a mouseup as a drop, the same as a pointerup', () => {
    const window = new DragCaptureWindow();
    play(window, [
      [true, 'pointerdown'],
      [false, 'mouseup'],
    ]);

    expect(window.hasSeenDrop()).toBe(true);
    expect(window.observe(false, 'pointermove').kind).toBe('frozen');
  });

  /** A drag still being held is not frozen, however many moves arrive. */
  it('keeps recording while the grab is held', () => {
    const window = new DragCaptureWindow();
    const verdicts = play(window, [
      [true, 'pointerdown'],
      ...Array.from({ length: 50 }, () => [true, 'pointermove'] as const),
    ]);

    expect(verdicts.filter((verdict) => verdict.kind === 'frozen')).toHaveLength(0);
    expect(window.hasSeenDrop()).toBe(false);
  });
});
