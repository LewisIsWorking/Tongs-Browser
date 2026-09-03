import type { AssignableUser, PartyCandidate } from '../foundry/PartyRoster.js';
import { NAME_LIMIT, type CreationRequest } from './CreationRequest.js';

/**
 * Whether a GM's client should honour a player's request to create a sheet. Added 2026-09-03.
 *
 * ⚠️ THIS IS THE ONLY THING STANDING IN THE WAY. Everywhere else in this feature, Foundry's own
 * enforcement is the backstop and our checks are a second line. Here that is inverted: the code runs
 * on a GM's client, and a GM may do anything. `sanitizeDocumentOwnershipField` returns the value
 * untouched for a GM, so the rule that stops a player granting ownership to somebody else is simply
 * absent on this path. Whatever Foundry would have refused, this function has to refuse.
 *
 * The pattern to hold on to: the relay does not "run the player's request as a GM". It decides, from
 * the GM's own view of the world, what the player was entitled to ask for, and does THAT.
 *
 * ⚠️ RE-READ, NEVER TRUSTED. The request names a party; whether that party is open to players is
 * read from the GM's copy, never taken from the payload. A request that carried its own permission
 * would be a request that granted itself.
 *
 * ⚠️ The bounded weakness, stated plainly. `request.userId` cannot be verified: core Foundry gives
 * the receiver no authenticated sender. A player can therefore claim another player's id and have
 * the sheet created owned by that person instead. What that CANNOT do is matter much: it only works
 * in a party a GM has already opened to players, it creates an ordinary character there, and it
 * names a real user. The damage is a misattributed sheet in a party where sheets were invited, not
 * access to anything. Worth telling Lewis, not worth blocking the feature.
 */
export type Authorisation =
  | {
      readonly kind: 'authorised';
      readonly ownerId: string;
      readonly partyUuid: string;
      readonly name: string;
    }
  | { readonly kind: 'refused'; readonly reason: string };

/** The GM's own view. Read on the GM's client, never sent by the requester. */
export interface RequestWorld {
  readonly parties: readonly PartyCandidate[];
  readonly users: readonly AssignableUser[];
}

/** Used when a request carries no usable name, so a blank field is not an error the user must fix. */
export const DEFAULT_NAME = 'New Character';

export function authoriseCreation(request: CreationRequest, world: RequestWorld): Authorisation {
  const party = world.parties.find((candidate) => candidate.uuid === request.partyUuid);
  if (party === undefined) {
    /*
     * ⚠️ "Cannot see" and "does not exist" are answered IDENTICALLY, on purpose. Telling a requester
     * that a party exists but is invisible to the GM would be a strange thing to leak, and the two
     * are indistinguishable from here anyway.
     */
    return { kind: 'refused', reason: 'That party is not one I can see.' };
  }

  if (!party.playerCreationEnabled) {
    return { kind: 'refused', reason: `${party.name} is not open to player characters.` };
  }

  /*
   * ⚠️ The requester must be a REAL user, checked against the GM's list. Without this, a request
   * could name any string as its owner and the resulting `ownership` entry would point at nobody,
   * producing a sheet with an owner that cannot be granted, revoked or found.
   */
  const owner = world.users.find((user) => user.id === request.userId);
  if (owner === undefined) {
    return { kind: 'refused', reason: 'I do not recognise the user asking.' };
  }

  /*
   * ⚠️ A GM asking through the relay is refused rather than served, and it is not an oversight. A GM
   * has the create flow directly, with the full picker and the choice of owner; routing them through
   * the player path would silently drop that choice and hand them a sheet owned by themselves. A
   * request that can only produce the wrong answer is better refused than honoured.
   */
  if (owner.isGm) {
    return { kind: 'refused', reason: 'A GM should use the create button directly.' };
  }

  return {
    kind: 'authorised',
    ownerId: owner.id,
    partyUuid: party.uuid,
    name: cleanName(request.name),
  };
}

/**
 * ⚠️ Trimmed and CAPPED, because this string is written into a world by a GM's client at a player's
 * request. The cap is not about malice so much as about a name being a label: something past
 * `NAME_LIMIT` is not a character name, and a document titled with an essay is a mess only a GM can
 * clear up.
 */
function cleanName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return DEFAULT_NAME;
  }
  return trimmed.slice(0, NAME_LIMIT);
}
