import type { PointerPosition } from './EventDescriptor.js';

/**
 * Conversion between two coordinate spaces, for cases where the space a point is expressed in
 * differs from the space a hit test expects.
 *
 * IMPORTANT, AND CONTRARY TO WHAT YOU MIGHT ASSUME. This must NOT be wired to the CSS UI scaling.
 * Browser hit testing is transform aware: document.elementFromPoint takes viewport coordinates and
 * accounts for CSS transforms itself, so a cursor drawn at viewport point P and a hit test at P
 * already agree, at any scale. Converting first would break a case that currently works.
 *
 * Verified empirically against Chromium rather than assumed. With a 400px box scaled to 0.5 about
 * its top left, containing a child at 200,200:
 *
 *   elementFromPoint(120, 120)  ->  the child      (its visual position)
 *   elementFromPoint(250, 250)  ->  nothing        (its untransformed layout position)
 *   child.getBoundingClientRect() -> left 100, top 100, width 50, height 50, already post transform
 *
 * So HitTester is left on the identity transform in normal operation, and the mechanism is kept for
 * the case that genuinely needs it: the phase 2 Android shell uses WebSettings.setInitialScale,
 * which does decouple device coordinates from CSS pixels in a way no CSS transform does.
 *
 * The transform is affine: multiply by the scale, then add the origin. Inverting means subtracting
 * the origin first, then dividing. Doing those two steps in the wrong order produces an error that
 * is invisible at 100 percent scale and grows with distance from the origin, which is exactly the
 * kind of bug that survives a casual test, hence the tests at three scales.
 */
export interface ScaleTransform {
  /** Uniform scale factor. 1 means no scaling. */
  readonly scale: number;
  /** Viewport coordinate that the scaled region's transform origin sits at. */
  readonly originX: number;
  readonly originY: number;
}

export const IDENTITY_TRANSFORM: ScaleTransform = Object.freeze({
  scale: 1,
  originX: 0,
  originY: 0,
});

export function createScaleTransform(scale: number, originX = 0, originY = 0): ScaleTransform {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError(`Scale must be a positive finite number, received ${String(scale)}.`);
  }
  return Object.freeze({ scale, originX, originY });
}

/**
 * Scaled space to viewport space.
 *
 * Use when you know where something sits inside the scaled interface and need the viewport point to
 * draw the cursor at.
 */
export function toViewportSpace(
  point: PointerPosition,
  transform: ScaleTransform
): PointerPosition {
  return {
    clientX: point.clientX * transform.scale + transform.originX,
    clientY: point.clientY * transform.scale + transform.originY,
  };
}

/**
 * Viewport space to scaled space.
 *
 * Use when you have a viewport point, such as where the cursor is drawn, and need the coordinate to
 * hand to a hit test against scaled content.
 */
export function toScaledSpace(point: PointerPosition, transform: ScaleTransform): PointerPosition {
  return {
    clientX: (point.clientX - transform.originX) / transform.scale,
    clientY: (point.clientY - transform.originY) / transform.scale,
  };
}

/** True when the transform is a no op, letting callers skip the arithmetic entirely. */
export function isIdentity(transform: ScaleTransform): boolean {
  return transform.scale === 1 && transform.originX === 0 && transform.originY === 0;
}
