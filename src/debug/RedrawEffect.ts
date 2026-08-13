import { STATE_NAMES } from './DragCallSite.js';

/**
 * What a token redraw did to the interaction underneath it. Extracted from FoundryDragHooks
 * 2026-08-13, when that file reached 214 lines against a hard 200 limit.
 *
 * ⚠️ REDRAWING A TOKEN CANCELS ITS INTERACTION, but only above HOVER. From Foundry's PlaceableObject,
 * in both `draw` and `destroy`:
 *
 *     if ( this.mouseInteractionManager?.state > INTERACTION_STATES.HOVER ) {
 *       this.mouseInteractionManager.interactionData.cancelled = true;
 *       this.mouseInteractionManager.cancel();
 *     }
 *
 * So anything redrawing the token mid gesture destroys the drag, at GRABBED, silently. A phone has
 * redraw causes a desktop does not: Foundry redraws on canvas resize, and on Android the URL bar
 * sliding in and out during a gesture resizes the viewport.
 *
 * ⚠️ This module exists because the note used to ASSERT the consequence instead of reading it. Every
 * redraw was labelled "this cancels the interaction", which is a claim about Foundry's `if` that the
 * probe never evaluated - and false for exactly the redraws at or below HOVER, which are the ordinary
 * harmless ones. A device then reported ~150 of them against a drag that had succeeded. An annotation
 * nothing checks is a comment that outranks the code.
 */

/** Foundry's HOVER state. At or below this a redraw does nothing to the interaction. */
const HOVER_STATE = 1;

/**
 * The phrase the summary matches on to know a redraw destroyed the interaction.
 *
 * Exported so the producer and the consumer cannot drift apart. A literal repeated in two files is
 * a rename away from a verdict that silently stops firing.
 *
 * ⚠️ Deliberately shouty and distinctive. The summary once matched the bare word "cancel", which the
 * HARMLESS note below also contains, in the phrase "did not cancel anything" - a sentence read as
 * agreeing with the claim it denies, because substring matching cannot see negation.
 */
export const REDRAW_CANCELLED = 'CANCELLED THE INTERACTION';

/**
 * Describe the effect, having READ the state that decides it.
 *
 * ⚠️ Three answers, not two. "No manager to read" is genuinely different from "did not cancel": the
 * first means the question could not be asked, and collapsing it into the second would report a
 * measurement that was never taken.
 *
 * ⚠️ Must be called BEFORE the redraw is delegated to, because the redraw is what performs the cancel
 * and resets the state. Read afterwards, every answer would be NONE.
 */
export function describeRedrawEffect(token: unknown): string {
  const state = (token as { mouseInteractionManager?: { state?: number } } | undefined)
    ?.mouseInteractionManager?.state;
  if (state === undefined) {
    return 'DURING THE DRAG, with no interaction manager to read (effect unknown)';
  }
  const named = STATE_NAMES[state] ?? String(state);
  return state > HOVER_STATE
    ? `at ${named}, which ${REDRAW_CANCELLED}`
    : `at ${named}, at or below HOVER, so it did not cancel anything`;
}
