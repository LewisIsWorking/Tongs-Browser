import { describe, expect, it } from 'vitest';

import {
  GestureState,
  GestureStateMachine,
  actionTypes,
  finger,
  machine,
} from './support/gestureHarness.js';

/**
 * The two states where the gesture's identity is already settled: TRACKING and DRAGGING.
 *
 * `SettledStates.ts` was at 61% statements and 50% branches, and the uncovered half was not the
 * ordinary path. It was the interruptions: a second finger arriving mid drag, a timer that should do
 * nothing, and a move that arrives with nothing to measure from. Those are exactly the cases a tablet
 * produces and a desk does not.
 */

/** TRACKING: a finger that has begun moving the pointer, so its release must not click. */
function startTracking(subject: GestureStateMachine): void {
  subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
  subject.handle({ type: 'touchmove', touches: [finger(0, 60, 60)], at: 40 });
}

/** DRAGGING: tap, then press and hold past the long press threshold. */
function startDrag(subject: GestureStateMachine): void {
  subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
  subject.handle({ type: 'touchend', touches: [], at: 50 });
  subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 120 });
  subject.handle({ type: 'timer', at: 320 });
}

describe('a second finger arriving mid gesture', () => {
  /**
   * ⚠️ THE DRAG MUST BE ENDED, not merely left behind. Without the `endDrag`, Foundry is holding a
   * token while the canvas begins to pan under it, and nothing ever tells it to let go. The token is
   * then dropped wherever the pan happens to finish.
   *
   * This is the same family as the sidebar thumb bug: a second finger is normal on a tablet, because
   * that is how a tablet is held.
   */
  it('ends the drag before handing over to the two finger gesture', () => {
    const subject = machine();
    startDrag(subject);

    const result = subject.handle({
      type: 'touchstart',
      touches: [finger(0, 10, 10), finger(1, 300, 300)],
      at: 400,
    });

    expect(result.state).toBe(GestureState.TWO_FINGER);
    expect(actionTypes(result.actions)).toEqual(['endDrag']);
  });

  it('hands over from tracking without an endDrag, since nothing was held', () => {
    const subject = machine();
    startTracking(subject);

    const result = subject.handle({
      type: 'touchstart',
      touches: [finger(0, 10, 10), finger(1, 300, 300)],
      at: 400,
    });

    expect(result.state).toBe(GestureState.TWO_FINGER);
    expect(result.actions).toEqual([]);
  });

  /** One finger arriving is not two. A stray touchstart must not disturb a settled gesture. */
  it('stays put when the new touchstart still carries only one finger', () => {
    const subject = machine();
    startDrag(subject);

    const result = subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 400 });

    expect(result.state).toBe(GestureState.DRAGGING);
    expect(result.actions).toEqual([]);
  });
});

/**
 * ⚠️ A release from TRACKING must produce NO click, and that is the whole difference between moving
 * the pointer and tapping. If a click leaked here, every gesture that moved the pointer would also
 * press wherever it stopped, which on a board means selecting or deselecting a token on every move.
 */
describe('releasing while tracking', () => {
  it('produces no click', () => {
    const subject = machine();
    startTracking(subject);

    const result = subject.handle({ type: 'touchend', touches: [], at: 300 });

    expect(result.state).toBe(GestureState.IDLE);
    expect(actionTypes(result.actions)).not.toContain('click');
    expect(result.actions).toEqual([]);
  });

  it('produces no click when the system cancels instead', () => {
    const subject = machine();
    startTracking(subject);

    const result = subject.handle({ type: 'touchcancel', at: 300 });

    expect(result.state).toBe(GestureState.IDLE);
    expect(result.actions).toEqual([]);
  });
});

/**
 * A move needs somewhere to measure from. These guards exist because a touchmove can arrive with an
 * empty list, and a delta computed against nothing would be the finger's absolute position: a single
 * jump of hundreds of pixels, which reads as the pointer teleporting.
 */
describe('a move with nothing to measure from', () => {
  it('does not move the pointer when the touch list is empty while tracking', () => {
    const subject = machine();
    startTracking(subject);

    const result = subject.handle({ type: 'touchmove', touches: [], at: 300 });

    expect(result.state).toBe(GestureState.TRACKING);
    expect(result.actions).toEqual([]);
  });

  it('does not drag when the touch list is empty while dragging', () => {
    const subject = machine();
    startDrag(subject);

    const result = subject.handle({ type: 'touchmove', touches: [], at: 400 });

    expect(result.state).toBe(GestureState.DRAGGING);
    expect(result.actions).toEqual([]);
  });
});

/**
 * ⚠️ A timer is inert once the gesture has settled. The long press timer is armed on every press and
 * fires regardless, so it arrives here routinely; acting on it would start a second gesture on top of
 * the one already running.
 */
describe('a timer arriving after the gesture has settled', () => {
  it('changes nothing while tracking', () => {
    const subject = machine();
    startTracking(subject);

    const result = subject.handle({ type: 'timer', at: 900 });

    expect(result.state).toBe(GestureState.TRACKING);
    expect(result.actions).toEqual([]);
  });

  it('changes nothing while dragging', () => {
    const subject = machine();
    startDrag(subject);

    const result = subject.handle({ type: 'timer', at: 900 });

    expect(result.state).toBe(GestureState.DRAGGING);
    expect(result.actions).toEqual([]);
  });
});
