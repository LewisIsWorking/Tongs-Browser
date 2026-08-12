/**
 * How much horizontal room there is before Foundry's sidebar. Extracted from TongsBrowser
 * 2026-08-12.
 *
 * This is the other half of the sidebar avoidance in `modifiers/BarClamp.ts`: that one decides where
 * the bar goes given a width, and this one decides what that width is. Splitting them is what lets
 * both be tested, since the clamp needs a number and this needs a DOM box, and neither needs both.
 */

/** The part of a `DOMRect` that matters here. */
export interface SidebarBox {
  readonly width: number;
  readonly left: number;
  readonly right: number;
}

/** A small gap, so the bar does not sit flush against the sidebar edge. */
const BREATHING_ROOM_PX = 4;

/**
 * The usable width to the left of the sidebar, or the whole viewport when there is no sidebar in the
 * way.
 *
 * ⚠️ Three separate ways the sidebar can be present in the DOM and still not be in the way, and all
 * three answer "the whole viewport" rather than some fraction of it:
 *
 * 1. **Zero width.** Foundry collapses the sidebar rather than removing it, so a collapsed sidebar is
 *    still an element with a box. Treating it as an obstacle would shrink the bar to nothing for a
 *    user who deliberately made room.
 * 2. **Entirely off the right edge.** Mid animation, or on a layout wider than the window.
 * 3. **Entirely off the left edge**, which is `right <= 0`.
 *
 * Returning a fraction in any of those cases produces a bar squeezed against an obstacle that is not
 * there, which reads as the module being broken rather than as a layout subtlety.
 */
export function availableWidthBesideSidebar(
  viewportWidth: number,
  sidebar: SidebarBox | null
): number {
  if (sidebar === null) {
    return viewportWidth;
  }

  if (sidebar.width === 0 || sidebar.left >= viewportWidth || sidebar.right <= 0) {
    return viewportWidth;
  }

  return Math.max(0, sidebar.left - BREATHING_ROOM_PX);
}
