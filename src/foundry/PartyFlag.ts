import { MODULE_ID } from '../constants.js';
import { PLAYER_CREATION_FLAG } from './PartyAccess.js';
import type { PartyCandidate } from './PartyRoster.js';

/**
 * Switching player creation on or off for one party. Added 2026-09-02.
 *
 * ⚠️ The WRITE half of the flag `PartyAccess` already reads. Until now the flag could authorise a
 * player and nothing could set it, which made requirement 2 a rule with no way to opt in: every party
 * was closed, permanently, and the only evidence would have been a player being told to ask their GM
 * by a GM who had no way to say yes.
 *
 * ⚠️ GM ONLY, enforced by Foundry rather than by this code. Writing a flag is a document update, so a
 * player attempting it is refused by the server. This module simply does not offer it to them, which
 * is the same reason the create button is GM only for now: a control that cannot work is worse than
 * one that is absent.
 */

/** A party actor, described only as far as writing the flag needs. */
export interface FlaggableParty {
  setFlag?: (scope: string, key: string, value: unknown) => Promise<unknown>;
}

export interface PartyFlagDeps {
  readonly resolveParty: (uuid: string) => Promise<FlaggableParty | null>;
}

/** What happened, in enough detail to tell the user something they can act on. */
export type FlagOutcome =
  | { readonly kind: 'set'; readonly enabled: boolean }
  | { readonly kind: 'failed'; readonly reason: string };

/**
 * Set whether players may create sheets in this party.
 *
 * ⚠️ Writes the value it was GIVEN rather than toggling what it reads. A toggle computed here would
 * be read-modify-write across a network: two GMs tapping at once, or one GM tapping twice on a slow
 * connection, and the party ends up in whichever state the race left it. The caller knows what the
 * user asked for; this writes exactly that.
 */
export async function setPlayerCreation(
  partyUuid: string,
  enabled: boolean,
  deps: PartyFlagDeps
): Promise<FlagOutcome> {
  try {
    const party = await deps.resolveParty(partyUuid);
    if (party?.setFlag === undefined) {
      return { kind: 'failed', reason: 'That party is no longer there.' };
    }
    await party.setFlag(MODULE_ID, PLAYER_CREATION_FLAG, enabled);
    return { kind: 'set', enabled };
  } catch (error) {
    return { kind: 'failed', reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * How a party's row should read in the access picker.
 *
 * ⚠️ Names the STATE, not the action. A row saying "Open to players" tells you what is true; a row
 * saying "Open this party" tells you what a tap does and leaves you guessing at the current state.
 * On a list where some rows are on and some are off, only the first form can be read at a glance,
 * and reading at a glance is the whole point of a list.
 */
export function describePartyAccess(party: PartyCandidate): string {
  return party.playerCreationEnabled
    ? `${party.name}: players may add characters`
    : `${party.name}: closed to players`;
}
