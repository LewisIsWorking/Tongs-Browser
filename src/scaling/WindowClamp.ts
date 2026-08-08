export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface ClampLimits {
  /** Fraction of viewport width a window may occupy. */
  readonly maxWidthFraction: number;
  readonly maxHeightFraction: number;
}

export const DEFAULT_CLAMP_LIMITS: ClampLimits = Object.freeze({
  maxWidthFraction: 0.95,
  maxHeightFraction: 0.9,
});

/**
 * Fits an application window inside the viewport.
 *
 * Pure arithmetic, separated from the DOM so it can be tested exhaustively. Foundry positions
 * windows for a desktop, so a character sheet opening at its default size on a phone routinely
 * lands partly or entirely off screen, with its header and close button out of reach. On a touch
 * device there is no way to recover from that: no keyboard shortcut, nothing to drag.
 *
 * Size is reduced before position is corrected, deliberately. Moving first and then shrinking can
 * leave a window that fits but sits in the wrong place, since the correction was computed against
 * the old dimensions.
 */
export function clampWindow(
  rect: Rect,
  viewport: Viewport,
  limits: ClampLimits = DEFAULT_CLAMP_LIMITS
): Rect {
  const maxWidth = viewport.width * limits.maxWidthFraction;
  const maxHeight = viewport.height * limits.maxHeightFraction;

  const width = Math.min(rect.width, maxWidth);
  const height = Math.min(rect.height, maxHeight);

  // Math.max with zero last, so a window larger than the viewport is pinned to the top left corner
  // rather than pushed off the opposite edge by a negative maximum.
  const left = Math.max(0, Math.min(rect.left, viewport.width - width));
  const top = Math.max(0, Math.min(rect.top, viewport.height - height));

  return { left, top, width, height };
}

/** True when the rect is not already fully inside the viewport at the allowed size. */
export function needsClamping(
  rect: Rect,
  viewport: Viewport,
  limits: ClampLimits = DEFAULT_CLAMP_LIMITS
): boolean {
  const clamped = clampWindow(rect, viewport, limits);
  return (
    clamped.left !== rect.left ||
    clamped.top !== rect.top ||
    clamped.width !== rect.width ||
    clamped.height !== rect.height
  );
}
