import { MODULE_ID } from '../constants.js';
import type { AssignableUser, PartyCandidate, Viewer } from './PartyRoster.js';

/**
 * The ONE place this module lists Foundry documents. Added 2026-09-02.
 *
 * ⚠️ `npm run check:documents` allows `game.actors` and `game.users` here and nowhere else in `src/`.
 * That is not bureaucracy: listing documents is the only thing this module does that can leak a name
 * a user has no permission to see. Everything else is about a pointer, and a pointer cannot tell a
 * player that a sheet or a party exists.
 *
 * The obligation that comes with being the boundary: enumerate and filter in the same breath. Nothing
 * unfiltered leaves this file.
 *
 * ⚠️ FAIL CLOSED. A document that cannot answer "may this user see you?" is EXCLUDED, not included.
 * Foundry already declines to send a client documents it has no permission for, so in practice this
 * filter is the second line rather than the first, but "the server would not have sent it" is a claim
 * about somebody else's code that nothing here can verify. The cost of being wrong in one direction
 * is a party missing from a list; in the other it is a name a player was never meant to read.
 */

/** Foundry's ownership levels, by the names its own `CONST` uses. */
const LIMITED = 'LIMITED';

/** An actor, described only as far as listing parties needs. */
export interface ActorLike {
  readonly uuid?: string;
  readonly name?: string;
  readonly type?: string;
  readonly isOwner?: boolean;
  testUserPermission?: (user: unknown, level: string) => boolean;
  getFlag?: (scope: string, key: string) => unknown;
}

export interface UserLike {
  readonly id?: string;
  readonly name?: string;
  readonly isGM?: boolean;
  readonly active?: boolean;
}

/** Foundry's `game`, described only as far as this reads it. */
export interface FoundryGame {
  readonly actors?: Iterable<ActorLike>;
  readonly users?: Iterable<UserLike>;
  readonly user?: UserLike;
}

export interface PartyAccessOptions {
  /** Read live rather than captured: a scene change or a reconnect replaces these collections. */
  readonly getGame: () => FoundryGame | undefined;
}

/** The party actor type, which PF2e and its derivatives both use. */
const PARTY_TYPE = 'party';

/** The flag a GM sets to let players create sheets in a given party. */
export const PLAYER_CREATION_FLAG = 'allowPlayerCreation';

/**
 * Every party this user is allowed to know exists.
 *
 * ⚠️ LIMITED is the bar, not OBSERVER, and the difference is deliberate. LIMITED is precisely the
 * level at which Foundry considers a name fit to show, and choosing a party to create in needs
 * nothing more than its name. Requiring OBSERVER would hide parties a player can legitimately see
 * listed elsewhere in Foundry's own interface, which would read as this module being broken.
 */
export function readParties(options: PartyAccessOptions): PartyCandidate[] {
  const game = options.getGame();
  const viewer = game?.user;
  if (game?.actors === undefined || viewer === undefined) {
    return [];
  }

  const parties: PartyCandidate[] = [];
  for (const actor of game.actors) {
    if (actor.type !== PARTY_TYPE) {
      continue;
    }
    if (actor.testUserPermission?.(viewer, LIMITED) !== true) {
      continue;
    }
    if (actor.uuid === undefined || actor.name === undefined) {
      continue;
    }
    parties.push({
      uuid: actor.uuid,
      name: actor.name,
      isOwner: actor.isOwner === true,
      playerCreationEnabled: actor.getFlag?.(MODULE_ID, PLAYER_CREATION_FLAG) === true,
    });
  }
  return parties;
}

/**
 * The users a sheet could be handed to.
 *
 * ⚠️ Unfiltered by permission ON PURPOSE, and it is worth saying why so that nobody "fixes" it. User
 * documents are not secret: Foundry shows every player's name in its own user list and on the login
 * screen, so hiding them here would protect nothing and would make a GM's picker wrong. WHO MAY BE
 * OFFERED is decided by `assignableUsers` in `PartyRoster`, which cuts a player's list to themselves.
 */
export function readUsers(options: PartyAccessOptions): AssignableUser[] {
  const game = options.getGame();
  if (game?.users === undefined) {
    return [];
  }

  const users: AssignableUser[] = [];
  for (const user of game.users) {
    if (user.id === undefined || user.name === undefined) {
      continue;
    }
    users.push({ id: user.id, name: user.name, isGm: user.isGM === true });
  }
  return users;
}

/** Who is asking. Absent or unidentifiable reads as a player, which is the safer of the two. */
export function readViewer(options: PartyAccessOptions): Viewer & { readonly id: string } {
  const user = options.getGame()?.user;
  return { id: user?.id ?? '', isGm: user?.isGM === true };
}
