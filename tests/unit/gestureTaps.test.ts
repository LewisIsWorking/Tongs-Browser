import { describe, expect, it } from 'vitest';

import {
  GestureState,
  GestureStateMachine,
  actionTypes,
  finger,
  machine,
} from './support/gestureHarness.js';

describe('GestureStateMachine: taps', () => {
  it('starts idle', () => {
    expect(machine().getState()).toBe(GestureState.IDLE);
  });

  it('enters LONG_PRESS_PENDING on a single finger down and asks for the long press timer', () => {
    const subject = machine({ longPressMs: 500 });
    const result = subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });

    expect(result.state).toBe(GestureState.LONG_PRESS_PENDING);
    expect(result.actions).toEqual([{ type: 'startTimer', durationMs: 500 }]);
  });

  it('produces a left click on a quick stationary release', () => {
    const subject = machine();
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    const result = subject.handle({ type: 'touchend', touches: [], at: 100 });

    expect(result.state).toBe(GestureState.IDLE);
    expect(actionTypes(result.actions)).toEqual(['cancelTimer', 'leftClick']);
  });

  it('produces no click when the touch is held too long to be a tap', () => {
    const subject = machine({ tapMaxMs: 200 });
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    const result = subject.handle({ type: 'touchend', touches: [], at: 400 });

    expect(actionTypes(result.actions)).toEqual(['cancelTimer']);
  });
});

describe('GestureStateMachine: long press', () => {
  it('produces a right click when the timer fires on a stationary finger', () => {
    const subject = machine();
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    const result = subject.handle({ type: 'timer', at: 500 });

    expect(actionTypes(result.actions)).toEqual(['rightClick']);
  });

  it('fires a haptic pulse alongside the right click when haptics are enabled', () => {
    const subject = new GestureStateMachine({ haptics: true });
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    const result = subject.handle({ type: 'timer', at: 500 });

    expect(result.actions).toEqual([{ type: 'rightClick' }, { type: 'haptic', durationMs: 15 }]);
  });

  /**
   * The finger is still down after a long press, so further movement must still move the pointer,
   * and the eventual release must not also produce a tap click. TRACKING is the state with exactly
   * those two properties, which is why the machine goes there rather than back to IDLE.
   */
  it('moves to TRACKING after the right click, so the release does not also click', () => {
    const subject = machine();
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    subject.handle({ type: 'timer', at: 500 });
    expect(subject.getState()).toBe(GestureState.TRACKING);

    const release = subject.handle({ type: 'touchend', touches: [], at: 600 });
    expect(release.state).toBe(GestureState.IDLE);
    expect(release.actions).toEqual([]);
  });

  it('cancels the long press once the finger moves past the slop', () => {
    const subject = machine({ tapSlopPx: 10 });
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    const result = subject.handle({ type: 'touchmove', touches: [finger(0, 40, 10)], at: 50 });

    expect(result.state).toBe(GestureState.TRACKING);
    expect(actionTypes(result.actions)).toEqual(['cancelTimer', 'movePointerBy']);
  });

  it('keeps waiting while the finger jitters within the slop', () => {
    const subject = machine({ tapSlopPx: 10 });
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    const result = subject.handle({ type: 'touchmove', touches: [finger(0, 14, 12)], at: 50 });

    expect(result.state).toBe(GestureState.LONG_PRESS_PENDING);
    expect(result.actions).toEqual([]);
  });
});
