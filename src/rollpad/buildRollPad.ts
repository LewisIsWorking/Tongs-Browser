import type { FoundryActions } from '../foundry/FoundryActions.js';
import { RollPad } from './RollPad.js';
import { rollOnPad } from './padRolls.js';

/**
 * The real Foundry behind the Roll Pad, built in ModuleParts beside the GM roll deck. Added 2026-10-08.
 *
 * "My character" is the one the tray's sheet button opens (`FoundryActions.myCharacter`), so the two
 * buttons never disagree about whose sheet and whose rolls they mean.
 *
 * Returns the tray's opener rather than the pad: the tray needs a command, not the panel.
 */
export function buildRollPad(
  doc: Document,
  actions: Pick<FoundryActions, 'myCharacter'>
): () => void {
  const pad = new RollPad({
    document: doc,
    character: () => actions.myCharacter(),
    roll: rollOnPad,
  });
  return () => {
    pad.open();
  };
}
