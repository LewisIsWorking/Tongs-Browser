import type { ScenePoint } from './TokenHitTest.js';

/**
 * Did the token actually move? Extracted from TongsBrowser 2026-08-12.
 *
 * ⚠️ This is the single most important line in the diagnostics report, and it is the only one that
 * answers the question anybody actually asked. Every other field describes EVENTS: what was
 * dispatched, what state Foundry reached, how far the pointer travelled. All of those can look
 * perfectly healthy while the token sits exactly where it started, which is precisely what happened
 * for three rounds of diagnosis.
 *
 * Comparing where the token was at the grab against where it is now says outright whether the
 * gesture achieved anything.
 */

/** Where a token was, or null when no grab has been recorded yet. */
export type GrabbedPosition = ScenePoint | null;

/**
 * Describe the movement, or say why it cannot be described.
 *
 * ⚠️ The two "cannot say" answers are deliberately DIFFERENT strings, and neither is a NO. "No grab
 * recorded" means the button was never pressed, so the report is about nothing; "no token selected
 * now" means the selection was lost between the grab and the report, which is itself a finding: a
 * token that deselects mid drag is one of the ways a drag silently ends. Collapsing either into "NO"
 * would report a failure that was never measured.
 */
export function describeTokenMovement(
  atGrab: GrabbedPosition,
  now: { readonly x?: number; readonly y?: number } | undefined
): string {
  if (atGrab === null) {
    return 'no grab recorded yet';
  }
  if (now?.x === undefined || now.y === undefined) {
    return 'no token selected now';
  }

  /*
   * Exact inequality rather than a threshold. Foundry snaps a dropped token to the grid, so a
   * committed move is always a whole square and never a sub pixel drift. A tolerance here would only
   * hide the case where the token moved a little and should not have.
   */
  const moved = now.x !== atGrab.x || now.y !== atGrab.y;

  /*
   * Both coordinates are printed whatever the answer, because a NO is not the end of the enquiry.
   * "NO (3000,1900 -> 3000,1900)" says the token was found and did not move; a bare NO leaves open
   * whether it was even the same token.
   */
  return `${moved ? 'YES' : 'NO'} (${String(atGrab.x)},${String(atGrab.y)} -> ${String(now.x)},${String(now.y)})`;
}
