import { describe, expect, it } from 'vitest';

import { centroid, distance, separation } from '../../src/gesture/TouchGeometry.js';

/**
 * The arithmetic behind every gesture decision.
 *
 * These three numbers decide whether a press is a tap or a drag, whether two fingers are pinching or
 * panning, and where a pinch is anchored. The state machine's own tests reach these edges only by
 * accident, because they arrive through a sequence of touches rather than by asking directly.
 */
const at = (clientX: number, clientY: number) => ({ clientX, clientY });

/** A TouchPoint carries an id, which the geometry ignores but the type requires. */
let nextId = 0;
const finger = (clientX: number, clientY: number) => ({ id: (nextId += 1), clientX, clientY });

describe('distance', () => {
  it('measures the straight line between two points', () => {
    expect(distance(at(0, 0), at(3, 4))).toBe(5);
  });

  it('is zero for a point and itself, which is what a stationary finger reports', () => {
    expect(distance(at(10, 20), at(10, 20))).toBe(0);
  });

  /** Symmetric, or the tap slop check would depend on which point was passed first. */
  it('does not care which point comes first', () => {
    expect(distance(at(1, 2), at(9, 14))).toBe(distance(at(9, 14), at(1, 2)));
  });

  it('handles negative coordinates, which a touch off the left edge produces', () => {
    expect(distance(at(-3, -4), at(0, 0))).toBe(5);
  });
});

describe('separation', () => {
  it('measures the gap between the first two fingers', () => {
    expect(separation([finger(0, 0), finger(0, 10)])).toBe(10);
  });

  /**
   * ⚠️ Zero is the honest answer and not a fallback, which is worth stating because a zero default is
   * usually the bug. A pinch is judged by the RATIO of separation now to separation at the start, and
   * both readings are taken only once two fingers are down. One finger has no separation to report.
   */
  it('is zero when there are not two fingers to measure', () => {
    expect(separation([])).toBe(0);
    expect(separation([finger(5, 5)])).toBe(0);
  });

  it('ignores a third finger, since the pinch is defined by the first two', () => {
    expect(separation([finger(0, 0), finger(0, 10), finger(999, 999)])).toBe(10);
  });
});

describe('centroid', () => {
  /**
   * ⚠️ Anchored to the CENTROID rather than to either finger, so a pinch zooms about the point
   * between thumb and forefinger. Following one finger would make the map lurch toward whichever the
   * browser reported first, and which one that is can change between events.
   */
  it('sits midway between two fingers, not on either of them', () => {
    expect(centroid([finger(0, 0), finger(10, 20)])).toEqual({ clientX: 5, clientY: 10 });
  });

  it('averages every finger down', () => {
    expect(centroid([finger(0, 0), finger(3, 0), finger(6, 30)])).toEqual({
      clientX: 3,
      clientY: 10,
    });
  });

  it('is the point itself for a single finger', () => {
    expect(centroid([finger(7, 9)])).toEqual({ clientX: 7, clientY: 9 });
  });

  it('is the origin for no fingers at all rather than a NaN', () => {
    expect(centroid([])).toEqual({ clientX: 0, clientY: 0 });
  });

  it('averages negative coordinates without sign errors', () => {
    expect(centroid([finger(-10, -20), finger(10, 20)])).toEqual({ clientX: 0, clientY: 0 });
  });
});
