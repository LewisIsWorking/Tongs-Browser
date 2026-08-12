import type { TouchPoint } from './GestureTypes.js';

/**
 * The arithmetic behind every gesture decision. Extracted from GestureStateMachine 2026-08-12.
 *
 * These three numbers decide whether a press is a tap or a drag, whether two fingers are pinching or
 * panning, and where a pinch is anchored. Each is a handful of lines and each has an edge case that
 * the state machine's own tests reach only by accident, because they arrive there through a sequence
 * of touches rather than by being asked directly.
 */

/** Distance between two points, in client pixels. */
export function distance(
  a: { readonly clientX: number; readonly clientY: number },
  b: { readonly clientX: number; readonly clientY: number }
): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * How far apart the first two fingers are. Zero when there are not two of them.
 *
 * ⚠️ Zero is the honest answer here and not a fallback, which is worth saying because a zero default
 * is usually the bug. A pinch is judged by the RATIO of separation now to separation at the start,
 * and both readings are taken only once two fingers are actually down. A single finger has no
 * separation to report rather than a separation that happens to be small.
 */
export function separation(touches: readonly TouchPoint[]): number {
  const [first, second] = touches;
  if (first === undefined || second === undefined) {
    return 0;
  }
  return distance(first, second);
}

/**
 * The midpoint of every finger down, which is what a two finger gesture is anchored to.
 *
 * ⚠️ Anchored to the CENTROID rather than to either finger, so a pinch zooms about the point between
 * the thumb and forefinger. Following one finger would make the map lurch toward whichever finger the
 * browser happened to report first, and which one that is can change between events.
 */
export function centroid(touches: readonly TouchPoint[]): {
  clientX: number;
  clientY: number;
} {
  if (touches.length === 0) {
    return { clientX: 0, clientY: 0 };
  }
  let sumX = 0;
  let sumY = 0;
  for (const touch of touches) {
    sumX += touch.clientX;
    sumY += touch.clientY;
  }
  return { clientX: sumX / touches.length, clientY: sumY / touches.length };
}
