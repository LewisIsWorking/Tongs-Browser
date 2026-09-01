import { describe, expect, it, vi } from 'vitest';

import {
  PLAYER_CREATION_FLAG,
  readParties,
  readUsers,
  readViewer,
  type ActorLike,
  type FoundryGame,
} from '../../src/foundry/PartyAccess.js';
import { MODULE_ID } from '../../src/constants.js';

/**
 * The one place this module lists Foundry documents. Written 2026-09-02.
 *
 * ⚠️ The assertion that matters is the NEGATIVE one: a party the viewer may not see must never come
 * back. Everything else in this file is arrangement around that.
 *
 * ⚠️ FAIL CLOSED is tested explicitly, because it is the behaviour most likely to be "simplified"
 * later. A document that cannot answer "may this user see you?" is excluded. Foundry would not
 * normally send such a document at all, which is exactly why the wrong version of this code would
 * pass every manual test somebody thought to run.
 *
 * COVERS: the permission filter, the type filter, the flag read, and the fail-closed default.
 * MISSES: whether Foundry's own filtering is correct. This is the second line, not the first.
 */
const GM = { id: 'gm1', name: 'Gamemaster', isGM: true };
const PLAYER = { id: 'p1', name: 'Ana', isGM: false };

function party(name: string, over: Partial<ActorLike> = {}): ActorLike {
  return {
    uuid: `Actor.${name}`,
    name,
    type: 'party',
    isOwner: false,
    testUserPermission: () => true,
    getFlag: () => undefined,
    ...over,
  };
}

const access = (game: FoundryGame) => ({ getGame: () => game });

describe('listing the parties a user may know exist', () => {
  it('returns the parties this client can see', () => {
    const game = { actors: [party('Alpha'), party('Beta')], user: GM };

    expect(readParties(access(game)).map((p) => p.name)).toEqual(['Alpha', 'Beta']);
  });

  it('ignores actors that are not parties', () => {
    const game = {
      actors: [party('Alpha'), party('Bob', { type: 'character' })],
      user: GM,
    };

    expect(readParties(access(game)).map((p) => p.name)).toEqual(['Alpha']);
  });

  /** ⚠️ THE ONE THAT MATTERS. A party the viewer has no permission on must not be named. */
  it('never returns a party the viewer may not see', () => {
    const game = {
      actors: [party('Visible'), party('Secret', { testUserPermission: () => false })],
      user: PLAYER,
    };

    expect(readParties(access(game)).map((p) => p.name)).toEqual(['Visible']);
  });

  /**
   * ⚠️ FAIL CLOSED. An actor that cannot answer the permission question is excluded. Foundry would
   * not normally send such a document, so the permissive version of this would pass every test
   * anybody thought to run by hand, and leak the day a document arrived in an unexpected shape.
   */
  it('excludes an actor that cannot answer whether it may be seen', () => {
    /*
     * ⚠️ Built WITHOUT the method rather than with it set to undefined. `exactOptionalPropertyTypes`
     * rejects the latter, and it is also the less honest fixture: the case being described is a
     * document that does not implement the question, not one that answers it with nothing.
     */
    const silent: ActorLike = { uuid: 'Actor.Silent', name: 'Silent', type: 'party' };
    const game = { actors: [party('Answers'), silent], user: PLAYER };

    expect(readParties(access(game)).map((p) => p.name)).toEqual(['Answers']);
  });

  it('asks about the CURRENT user, not some other one', () => {
    const testUserPermission = vi.fn(() => true);
    const game = { actors: [party('Alpha', { testUserPermission })], user: PLAYER };

    readParties(access(game));

    expect(testUserPermission).toHaveBeenCalledWith(PLAYER, 'LIMITED');
  });

  it('reads the player creation flag from this module scope', () => {
    const getFlag = vi.fn((scope: string, key: string) =>
      scope === MODULE_ID && key === PLAYER_CREATION_FLAG ? true : undefined
    );
    const game = { actors: [party('Open', { getFlag })], user: GM };

    expect(readParties(access(game))[0]?.playerCreationEnabled).toBe(true);
  });

  it('treats a party with no flag as closed to players', () => {
    const game = { actors: [party('Closed')], user: GM };

    expect(readParties(access(game))[0]?.playerCreationEnabled).toBe(false);
  });

  /**
   * ⚠️ A party with no name is SKIPPED rather than rendered. A picker row with no label is worse than
   * a missing row: it is tappable, it creates a sheet somewhere, and the user cannot tell where.
   */
  it('skips a party that has no name or no uuid to identify it', () => {
    const nameless: ActorLike = { uuid: 'Actor.X', type: 'party', testUserPermission: () => true };
    const anonymous: ActorLike = { name: 'No uuid', type: 'party', testUserPermission: () => true };
    const game = { actors: [party('Alpha'), nameless, anonymous], user: GM };

    expect(readParties(access(game)).map((p) => p.name)).toEqual(['Alpha']);
  });

  it('returns nothing rather than throwing when there is no game yet', () => {
    expect(readParties({ getGame: () => undefined })).toEqual([]);
    expect(readParties(access({ actors: [party('Alpha')] }))).toEqual([]);
  });
});

describe('listing the users a sheet could go to', () => {
  /**
   * ⚠️ Deliberately NOT permission filtered, and this asserts that on purpose so nobody "fixes" it.
   * Foundry shows every player's name in its own user list and on the login screen, so hiding them
   * here would protect nothing and make a GM's picker wrong. Who may be OFFERED is `assignableUsers`.
   */
  it('returns every user, leaving who may be offered to the roster rules', () => {
    const game = { users: [GM, PLAYER] };

    expect(readUsers(access(game)).map((u) => u.name)).toEqual(['Gamemaster', 'Ana']);
  });

  it('marks which of them are GMs', () => {
    expect(readUsers(access({ users: [GM, PLAYER] })).map((u) => u.isGm)).toEqual([true, false]);
  });

  /** ⚠️ Same reason as the nameless party: an unlabelled row in an assignment picker is untappable. */
  it('skips a user with no id or no name', () => {
    const game = { users: [GM, { id: 'ghost' }, { name: 'No id', isGM: false }] };

    expect(readUsers(access(game)).map((u) => u.name)).toEqual(['Gamemaster']);
  });

  it('returns nothing rather than throwing when there is no game yet', () => {
    expect(readUsers({ getGame: () => undefined })).toEqual([]);
  });
});

describe('who is asking', () => {
  it('reports a GM as a GM', () => {
    expect(readViewer(access({ user: GM }))).toEqual({ id: 'gm1', isGm: true });
  });

  /** ⚠️ An unidentifiable viewer reads as a PLAYER, which is the safer of the two mistakes. */
  it('treats an absent user as a player', () => {
    expect(readViewer({ getGame: () => undefined })).toEqual({ id: '', isGm: false });
  });
});
