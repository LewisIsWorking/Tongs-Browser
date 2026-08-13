import type { InstalledHooks } from './FoundryDragHooks.js';
import { REDRAW_CANCELLED } from './RedrawEffect.js';
import type { MovementVerdict } from './TokenMovement.js';

/**
 * Turn the drag observations into the one line the report prints. Split out of FoundryDragHooks
 * 2026-08-13, when the outcome had to be threaded in and that file reached the 200 line limit.
 *
 * ⚠️ This line USED TO LIE, and the way it lied is the reason the signature now demands an outcome.
 *
 * A device reported a drag that plainly worked - `DID IT MOVE: YES (3100,2000 -> 3000,2200)` in the
 * same report, forty lines above - under the verdict "a REDRAW cancelled the interaction, which is
 * why nothing was written". Two failures stacked:
 *
 *   1. The redraw branch was tested FIRST, so it shadowed the drop branch. Any drag that redrew was
 *      reported as a redraw failure no matter what else was observed.
 *   2. "which is why nothing was written" is a claim about the OUTCOME, and the outcome was never
 *      passed in. It was inferred from the mechanism, which is exactly backwards: mechanisms are
 *      evidence, outcomes are facts, and when they disagree the fact wins.
 *
 * So `movement` is REQUIRED and unvalued - there is no default. A default would have let this
 * function keep guessing at the one thing it must be told.
 */
/** The observations that mean Foundry threw the interaction away, named rather than described. */
const CANCEL_OBSERVATIONS = ['manager.cancel', 'manager.reset', '_onDragLeftCancel'];

export function summariseDragEndings(
  observations: readonly string[],
  installed: InstalledHooks,
  movement: MovementVerdict
): string {
  if (!installed.token) {
    return 'NOT WATCHING. The observers never installed, so this line says nothing about the drag.';
  }
  if (observations.length === 0) {
    return installed.manager
      ? 'NOTHING observed, and the observers ARE installed, so Foundry genuinely did none of these.'
      : 'nothing observed, but the MANAGER hook never installed, so a cancel at GRABBED would be invisible.';
  }
  return `${observations.join(' then ')} ${verdictFor(observations, movement)}`;
}

/**
 * The verdict, decided by the OUTCOME first and the mechanism only afterwards.
 *
 * ⚠️ The order of these branches is the fix. `moved` short circuits everything below it, because no
 * amount of observed cancelling changes the fact that the token ended up somewhere new - a cancelled
 * interaction that nonetheless committed is a real and interesting state, and the old ordering
 * printed it as a plain failure.
 */
function verdictFor(observations: readonly string[], movement: MovementVerdict): string {
  if (movement === 'moved') {
    return '<em>(and the token MOVED, so whatever else these show, the drag committed)</em>';
  }

  /*
   * ⚠️ Only `unmoved` licenses the phrase "nothing was written". The other two verdicts mean the
   * question was never answerable: no grab was recorded, or the selection was gone by the time the
   * report was written. Saying "nothing was written" there would be reporting a failure nobody
   * measured, which is the same defect as the one this whole function was rewritten for.
   */
  if (movement !== 'unmoved') {
    return `<em>(whether anything was written is UNKNOWN: ${describeWhyUnknown(movement)})</em>`;
  }

  if (observations.some((note) => note.includes(REDRAW_CANCELLED))) {
    return '<em>(a REDRAW cancelled the interaction, and the token did not move)</em>';
  }
  if (observations.some((note) => note.includes('_onDragLeftDrop'))) {
    return '<em>(dropped, so Foundry tried to commit and the write itself refused)</em>';
  }
  /*
   * ⚠️ Matched on the METHOD NAMES, not on the word "cancel". This branch used to test
   * `note.toLowerCase().includes('cancel')`, and the redraw note that says "so it did not cancel
   * anything" satisfied it - a sentence was read as agreeing with the very claim it denies, because
   * `includes` cannot see negation. Prose is for the reader; matching belongs on the identifiers.
   */
  if (observations.some((note) => CANCEL_OBSERVATIONS.some((name) => note.startsWith(name)))) {
    return '<em>(CANCELLED, which writes nothing)</em>';
  }
  return '<em>(no ending observed, and the token did not move)</em>';
}

/** Why the outcome could not be judged, in the reader's terms rather than the enum's. */
function describeWhyUnknown(movement: MovementVerdict): string {
  return movement === 'no-grab'
    ? 'no grab was ever recorded, so this report is not about a drag'
    : 'no token was selected when the report was written, so there was nothing to compare';
}
