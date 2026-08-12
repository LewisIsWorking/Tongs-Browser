import type { BarPosition } from './BarPosition.js';

/**
 * Keeping the modifier bar on screen AND off the sidebar. Extracted from ModifierBar 2026-08-12.
 *
 * ⚠️ Pure arithmetic on purpose, and that is what makes it testable at all. jsdom reports
 * `offsetWidth` as 0 for everything, so the DOM suite around the bar cannot exercise a single one of
 * these cases: every clamp it runs is against a zero sized bar, where the maths degenerates and every
 * branch below collapses to the same answer. Separating the numbers from the element is the only way
 * this behaviour gets checked without a real layout engine.
 */

export interface ClampInput {
  /** Where the bar wants to be. */
  readonly desired: BarPosition;
  /** The bar's rendered size. Zero before layout, in which case clamping is a no op. */
  readonly barWidth: number;
  readonly barHeight: number;
  /**
   * How much horizontal room there is before Foundry's sidebar, when the caller knows. Undefined
   * means nobody asked, and the full window is used.
   */
  readonly availableWidth: number | undefined;
  readonly viewport: { readonly width: number; readonly height: number };
}

export interface ClampResult {
  readonly position: BarPosition;
  /**
   * A cap on the bar's width, which is needed as well as the position.
   *
   * The bar is `position: fixed` with only `left` set, so it is shrink to fit against the space that
   * remains: its used width is min(max-content, max-width, viewport - left). Moving it LEFT makes it
   * WIDER and its right edge stays pinned to the viewport edge. Measured on a 412px phone: clamping x
   * from 88 to 65 changed the width from 324 to 347 and the right edge stayed at 412. Position alone
   * cannot fix this.
   */
  readonly maxWidth: number;
}

/**
 * Clamp the bar into the room it actually has.
 *
 * ⚠️ Keeps out of the SIDEBAR, not just out of the window. Measured 2026-08-11 on a 412px phone
 * viewport: once the bar wraps it reaches the right edge, and Foundry's sidebar lives there, so the
 * shipped default covered the sidebar's icon column between y 120 and 250. That is worse than
 * covering anything else, because the sidebar is how the user reaches chat, actors and every other
 * part of Foundry.
 *
 * ⚠️ Falls back to the full window when honouring the available width would push the bar off the LEFT
 * edge instead. Trading a covered sidebar for a bar hanging off the screen is not a fix, and a bar
 * that is wider than the room beside the sidebar has no correct position: the least wrong answer is
 * the one where all of it is still reachable.
 */
export function clampBarPosition(input: ClampInput): ClampResult {
  const available = input.availableWidth ?? input.viewport.width;
  const usableWidth = available >= input.barWidth ? available : input.viewport.width;

  const maxX = Math.max(0, usableWidth - input.barWidth);
  const maxY = Math.max(0, input.viewport.height - input.barHeight);

  const position: BarPosition = {
    x: Math.min(Math.max(input.desired.x, 0), maxX),
    y: Math.min(Math.max(input.desired.y, 0), maxY),
  };

  /*
   * Computed from the CLAMPED x rather than the desired one, which is what makes this converge in a
   * single pass: the clamp picks x from the current width, and this caps the width so the right edge
   * lands exactly on the available width.
   */
  return { position, maxWidth: Math.max(0, usableWidth - position.x) };
}
