import { describe, expect, it } from 'vitest';

import { GestureStateMachine } from '../../src/gesture/GestureStateMachine.js';
import {
  GestureState,
  type GestureAction,
  type GestureConfig,
  type TouchPoint,
} from '../../src/gesture/GestureTypes.js';

/**
 * The gesture machine is the part most likely to acquire "which mode am I in" bugs, so the tests
 * enumerate transitions rather than sampling them. Everything here runs in plain node: the machine
 * never reads a clock, sets a timer, or touches the DOM.
 */

const finger = (id: number, clientX: number, clientY: number): TouchPoint => ({
  id,
  clientX,
  clientY,
});

function machine(config: Partial<GestureConfig> = {}): GestureStateMachine {
  return new GestureStateMachine({ haptics: false, sensitivity: 1, ...config });
}

const actionTypes = (actions: readonly GestureAction[]): string[] =>
  actions.map((action) => action.type);

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

describe('GestureStateMachine: two finger gestures', () => {
  it('enters TWO_FINGER when a second finger lands', () => {
    const subject = machine();
    const result = subject.handle({
      type: 'touchstart',
      touches: [finger(0, 100, 100), finger(1, 200, 100)],
      at: 0,
    });

    expect(result.state).toBe(GestureState.TWO_FINGER);
  });

  it('pans the canvas by the centroid delta', () => {
    const subject = machine();
    subject.handle({
      type: 'touchstart',
      touches: [finger(0, 100, 100), finger(1, 200, 100)],
      at: 0,
    });

    const result = subject.handle({
      type: 'touchmove',
      touches: [finger(0, 110, 120), finger(1, 210, 120)],
      at: 50,
    });

    expect(result.state).toBe(GestureState.TWO_FINGER);
    expect(result.actions).toEqual([{ type: 'panCanvasBy', deltaX: 10, deltaY: 20 }]);
  });

  /**
   * Pan and zoom are kept apart deliberately. Applying both from one gesture makes the canvas lurch,
   * because any pinch also drags the centroid slightly.
   */
  it('switches to PINCHING once the separation changes past the threshold', () => {
    const subject = machine({ pinchThresholdPx: 12 });
    subject.handle({
      type: 'touchstart',
      touches: [finger(0, 100, 100), finger(1, 200, 100)],
      at: 0,
    });

    const result = subject.handle({
      type: 'touchmove',
      touches: [finger(0, 100, 100), finger(1, 300, 100)],
      at: 50,
    });

    expect(result.state).toBe(GestureState.PINCHING);
    expect(result.actions).toEqual([{ type: 'zoomCanvas', ratio: 2, centerX: 200, centerY: 100 }]);
  });

  it('does not zoom on separation noise below the threshold', () => {
    const subject = machine({ pinchThresholdPx: 12 });
    subject.handle({
      type: 'touchstart',
      touches: [finger(0, 100, 100), finger(1, 200, 100)],
      at: 0,
    });

    const result = subject.handle({
      type: 'touchmove',
      touches: [finger(0, 100, 100), finger(1, 205, 100)],
      at: 50,
    });

    expect(result.state).toBe(GestureState.TWO_FINGER);
    expect(actionTypes(result.actions)).toEqual(['panCanvasBy']);
  });

  it('keeps zooming once pinching, without switching back to panning', () => {
    const subject = machine({ pinchThresholdPx: 12 });
    subject.handle({
      type: 'touchstart',
      touches: [finger(0, 100, 100), finger(1, 200, 100)],
      at: 0,
    });
    subject.handle({
      type: 'touchmove',
      touches: [finger(0, 100, 100), finger(1, 300, 100)],
      at: 50,
    });

    const result = subject.handle({
      type: 'touchmove',
      touches: [finger(0, 100, 100), finger(1, 305, 100)],
      at: 80,
    });

    expect(result.state).toBe(GestureState.PINCHING);
    expect(actionTypes(result.actions)).toEqual(['zoomCanvas']);
  });

  it('returns to idle when a finger lifts, rather than handing the survivor to the pointer', () => {
    const subject = machine();
    subject.handle({
      type: 'touchstart',
      touches: [finger(0, 100, 100), finger(1, 200, 100)],
      at: 0,
    });

    const result = subject.handle({ type: 'touchend', touches: [finger(0, 100, 100)], at: 50 });
    expect(result.state).toBe(GestureState.IDLE);
  });

  it('ends an in progress drag when a second finger arrives', () => {
    const subject = machine();
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 0 });
    subject.handle({ type: 'touchend', touches: [], at: 50 });
    subject.handle({ type: 'touchstart', touches: [finger(0, 10, 10)], at: 120 });
    subject.handle({ type: 'timer', at: 320 });

    const result = subject.handle({
      type: 'touchstart',
      touches: [finger(0, 10, 10), finger(1, 200, 100)],
      at: 400,
    });

    expect(result.state).toBe(GestureState.TWO_FINGER);
    expect(result.actions).toEqual([{ type: 'endDrag' }]);
  });
});

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
});
