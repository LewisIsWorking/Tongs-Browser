/**
 * Was the pointer actually on the token? Extracted from TongsBrowser 2026-08-12.
 *
 * This answers `insideSelectedToken` in the diagnostics report, which is the field that separates
 * "the drag did not work" from "the drag was never aimed at anything", and those are completely
 * different problems.
 */

/** A point in SCENE coordinates, which is what Foundry's `canvas.mousePosition` reports. */
export interface ScenePoint {
  readonly x?: number;
  readonly y?: number;
}

/**
 * A token's box.
 *
 * ⚠️ `w`/`h` are the RENDERED size in scene units and are not `document.width`, which is a size in
 * GRID SQUARES. A hit test written against the document's width silently tests a box one square
 * across, which on a 100px grid is a 99% miss.
 */
export interface TokenBox {
  readonly document?: { readonly x?: number; readonly y?: number };
  readonly w?: number;
  readonly h?: number;
}

/**
 * Whether a scene point lies within a token's box.
 *
 * ⚠️ Every field must be PRESENT. Missing data answers no, never yes, and that rule is the fix for a
 * real defect rather than defensiveness.
 *
 * The x axis used to be guarded and the y axis not: y read `(mouse.y ?? 0) >= (document.y ?? 0)`, so
 * a token or a mouse position with no y at all evaluated `0 >= 0 && 0 <= 0` and reported INSIDE. A
 * missing width was worse in the other direction, since `w ?? 0` makes the box zero pixels wide and
 * only the exact left edge counts as a hit.
 *
 * Both are readings this report cannot afford to get wrong in either direction: a false "inside"
 * sends somebody hunting a drag bug when the pointer was never on the token, and a false "outside"
 * sends them to aim a pointer that was already on target.
 */
export function isPointerInsideToken(
  mouse: ScenePoint | undefined,
  token: TokenBox | undefined
): boolean {
  const left = token?.document?.x;
  const top = token?.document?.y;

  if (
    mouse?.x === undefined ||
    mouse.y === undefined ||
    left === undefined ||
    top === undefined ||
    token?.w === undefined ||
    token.h === undefined
  ) {
    return false;
  }

  return mouse.x >= left && mouse.x <= left + token.w && mouse.y >= top && mouse.y <= top + token.h;
}

/** The report's phrasing for the pointer's scene position, rounded because sub-pixels say nothing. */
export function describeScenePoint(mouse: ScenePoint | undefined): string {
  if (mouse?.x === undefined || mouse.y === undefined) {
    return 'n/a';
  }
  return `(${String(Math.round(mouse.x))}, ${String(Math.round(mouse.y))})`;
}

/**
 * The report's phrasing for what is selected.
 *
 * "NONE, tap a token first" rather than "NONE", because every other field about a drag is meaningless
 * without a selection and the reader needs to know the next action rather than the state.
 */
export function describeControlledToken(
  token: (TokenBox & { readonly name?: string }) | undefined
): string {
  if (token === undefined) {
    return 'NONE, tap a token first';
  }
  return `${token.name ?? 'unnamed'} at (${String(token.document?.x)}, ${String(token.document?.y)})`;
}
