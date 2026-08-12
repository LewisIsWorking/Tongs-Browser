import { describe, expect, it } from 'vitest';

import { GestureState, actionTypes, finger, machine } from './support/gestureHarness.js';

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
