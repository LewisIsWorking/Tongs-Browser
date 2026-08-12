import { describe, expect, it } from 'vitest';

import { GestureState, finger, machine } from './support/gestureHarness.js';

describe('GestureStateMachine: pointer modes', () => {
  it('moves by a scaled relative delta in trackpad mode', () => {
    const subject = machine({ pointerMode: 'trackpad', sensitivity: 1.5, tapSlopPx: 5 });
    subject.handle({ type: 'touchstart', touches: [finger(0, 100, 100)], at: 0 });

    const result = subject.handle({ type: 'touchmove', touches: [finger(0, 120, 110)], at: 50 });
    expect(result.actions).toContainEqual({ type: 'movePointerBy', deltaX: 30, deltaY: 15 });
  });

  /**
   * Offset mode is absolute, and the pointer sits above the finger so the fingertip never covers
   * the thing being aimed at. Sensitivity deliberately does not apply: the pointer tracks the
   * finger one to one, just displaced.
   */
  it('places the pointer a fixed distance above the finger in offset mode', () => {
    const subject = machine({ pointerMode: 'offset', offsetDistancePx: 60, tapSlopPx: 5 });
    subject.handle({ type: 'touchstart', touches: [finger(0, 100, 300)], at: 0 });

    const result = subject.handle({ type: 'touchmove', touches: [finger(0, 140, 320)], at: 50 });
    expect(result.actions).toContainEqual({
      type: 'movePointerTo',
      position: { clientX: 140, clientY: 260 },
    });
  });
});

describe('GestureStateMachine: reset', () => {
  it('returns to idle and forgets the pending tap', () => {
    const subject = machine();
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    subject.handle({ type: 'touchend', touches: [], at: 50 });
    subject.reset();

    expect(subject.getState()).toBe(GestureState.IDLE);

    const next = subject.handle({ type: 'touchstart', touches: [finger(0, 12, 12)], at: 120 });
    expect(next.actions).toEqual([{ type: 'startTimer', durationMs: 500 }]);
  });

  /**
   * A gesture after a reset is measured from its OWN start, never from the one before it.
   *
   * ⚠️ Worth saying what this does not prove. Clearing the last position inside `reset` is hygiene
   * rather than a fix: `fromIdle` writes the position on every fresh `touchstart`, before any move
   * can read it, so removing that line leaves this test green. That was checked by removing it, not
   * assumed. What this DOES pin is the outcome a user would notice, which holds either way.
   */
  it('measures the next gesture from its own start, not the previous one', () => {
    const subject = machine();
    // Track a finger a long way across the screen, leaving a last position of (500, 500).
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    subject.handle({ type: 'touchmove', touches: [finger(0, 500, 500)], at: 50 });
    expect(subject.getState()).toBe(GestureState.TRACKING);

    subject.reset();

    // A fresh gesture starting back at the origin must not be measured against (500, 500).
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 200 });
    const moved = subject.handle({ type: 'touchmove', touches: [finger(0, 40, 10)], at: 250 });

    // 30px of finger travel. A stale position would measure from (500, 500) and produce a delta of
    // roughly (-460, -490): the pointer flung across the screen on the first move.
    expect(moved.actions).toContainEqual({ type: 'movePointerBy', deltaX: 30, deltaY: 0 });
  });
});
