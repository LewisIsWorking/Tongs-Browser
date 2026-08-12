import { describe, expect, it } from 'vitest';

import { GestureState, actionTypes, finger, machine } from './support/gestureHarness.js';

describe('GestureStateMachine: double tap and tap then hold', () => {
  /**
   * These two gestures begin identically. Only the duration of the second touch distinguishes them,
   * so both are handled from the same state and the timer decides which one it was.
   */
  it('produces a double click when a second tap is released quickly', () => {
    const subject = machine({ doubleTapWindowMs: 300 });
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    subject.handle({ type: 'touchend', touches: [], at: 50 });

    subject.handle({ type: 'touchstart', touches: [finger(0, 12, 12)], at: 120 });
    const result = subject.handle({ type: 'touchend', touches: [], at: 170 });

    expect(actionTypes(result.actions)).toEqual(['cancelTimer', 'doubleClick']);
  });

  it('begins a drag when the second touch is held instead of released', () => {
    const subject = machine({ doubleTapWindowMs: 300, tapMaxMs: 200 });
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    subject.handle({ type: 'touchend', touches: [], at: 50 });

    subject.handle({ type: 'touchstart', touches: [finger(0, 12, 12)], at: 120 });
    const result = subject.handle({ type: 'timer', at: 320 });

    expect(result.state).toBe(GestureState.DRAGGING);
    expect(actionTypes(result.actions)).toEqual(['beginDrag']);
  });

  it('waits only the tap duration before committing to a drag, not the full long press', () => {
    const subject = machine({ tapMaxMs: 200, longPressMs: 500, doubleTapWindowMs: 300 });
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    subject.handle({ type: 'touchend', touches: [], at: 50 });

    const second = subject.handle({ type: 'touchstart', touches: [finger(0, 12, 12)], at: 120 });
    expect(second.actions).toEqual([{ type: 'startTimer', durationMs: 200 }]);
  });

  it('treats a second touch outside the time window as an unrelated fresh gesture', () => {
    const subject = machine({ doubleTapWindowMs: 300, longPressMs: 500 });
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    subject.handle({ type: 'touchend', touches: [], at: 50 });

    const second = subject.handle({ type: 'touchstart', touches: [finger(0, 12, 12)], at: 900 });
    expect(second.actions).toEqual([{ type: 'startTimer', durationMs: 500 }]);

    const result = subject.handle({ type: 'touchend', touches: [], at: 950 });
    expect(actionTypes(result.actions)).toEqual(['cancelTimer', 'leftClick']);
  });

  it('treats a second touch too far away as an unrelated fresh gesture', () => {
    const subject = machine({ doubleTapSlopPx: 30, longPressMs: 500 });
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    subject.handle({ type: 'touchend', touches: [], at: 50 });

    const second = subject.handle({ type: 'touchstart', touches: [finger(0, 400, 400)], at: 120 });
    expect(second.actions).toEqual([{ type: 'startTimer', durationMs: 500 }]);
  });
});
