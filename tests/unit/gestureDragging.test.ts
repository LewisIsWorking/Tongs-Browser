import { describe, expect, it } from 'vitest';

import { GestureState, GestureStateMachine, finger, machine } from './support/gestureHarness.js';

describe('GestureStateMachine: dragging', () => {
  function startDrag(subject: GestureStateMachine): void {
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    subject.handle({ type: 'touchend', touches: [], at: 50 });
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 120 });
    subject.handle({ type: 'timer', at: 320 });
  }

  it('emits drag steps while the finger moves', () => {
    const subject = machine();
    startDrag(subject);

    const result = subject.handle({ type: 'touchmove', touches: [finger(0, 40, 30)], at: 400 });
    expect(result.state).toBe(GestureState.DRAGGING);
    expect(result.actions).toEqual([{ type: 'dragBy', deltaX: 30, deltaY: 20 }]);
  });

  it('ends the drag on release', () => {
    const subject = machine();
    startDrag(subject);

    const result = subject.handle({ type: 'touchend', touches: [], at: 500 });
    expect(result.state).toBe(GestureState.IDLE);
    expect(result.actions).toEqual([{ type: 'endDrag' }]);
  });

  /**
   * A system interruption, an incoming call or the Android gesture bar, must abandon rather than
   * complete the drag. Completing it would drop the token wherever the finger happened to be.
   */
  it('abandons rather than completes the drag when the touch is cancelled', () => {
    const subject = machine();
    startDrag(subject);

    const result = subject.handle({ type: 'touchcancel', at: 500 });
    expect(result.state).toBe(GestureState.IDLE);
    expect(result.actions).toEqual([{ type: 'cancelDrag' }]);
  });

  it('applies the sensitivity multiplier to drag steps', () => {
    const subject = machine({ sensitivity: 2 });
    startDrag(subject);

    const result = subject.handle({ type: 'touchmove', touches: [finger(0, 20, 10)], at: 400 });
    expect(result.actions).toEqual([{ type: 'dragBy', deltaX: 20, deltaY: 0 }]);
  });
});
