import type { PointerPosition } from './EventDescriptor.js';

/**
 * Conversion between the coordinates the cursor is drawn at and the coordinates hit testing has to
 * use.
 *
 * The UI scaling layer applies `transform: scale()` to Foundry's HTML chrome. A scaled element is
 * painted smaller but keeps its original layout box, and document.elementFromPoint works in
 * unscaled viewport coordinates. So a cursor drawn at viewport point P sits visually over a
 * different element than the one elementFromPoint reports for P, and every click lands somewhere
 * other than where the user aimed.
 *
 * This is the single most likely source of that whole class of bug, so all of the arithmetic lives
 * here, behind one type, and every hit test goes through it.
 *
 * The transform is affine: multiply by the scale, then add the origin. Inverting means subtracting
 * the origin first, then dividing. Doing those two steps in the wrong order is the classic mistake
 * and produces an error that is invisible at 100 percent scale and grows with distance from the
 * origin, which is exactly the kind of bug that survives a casual test.
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
