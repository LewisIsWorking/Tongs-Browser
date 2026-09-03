import { describe, expect, it } from 'vitest';

import { readGmPresence } from '../../src/foundry/DesignatedGm.js';
import type { GmGame } from '../../src/foundry/DesignatedGm.js';

/**
 * Which GM answers, and whether there is one. Written 2026-09-03.
 *
 * ⚠️ The case that matters most is the one with NO ids. Comparing `undefined` to `undefined` would
 * make an unidentifiable client believe it is the designated GM, and the designated GM is the client
 * that ACTS on other people's requests. That failure is silent, and it is worse the more clients are
 * connected, because every confused one acts.
 *
 * COVERS: nobody online, somebody else designated, me designated, and every way an id can be missing.
 * MISSES: whether Foundry's `activeGM` really does pick the same user on every client. That is
 *   Foundry's own rule and the live harness's job, not something a fake can demonstrate.
 */
const game = (activeGM: unknown, user: unknown): GmGame =>
  ({ users: { activeGM }, user }) as GmGame;

const read = (activeGM: unknown, user: unknown): ReturnType<typeof readGmPresence> =>
  readGmPresence({ getGame: () => game(activeGM, user) });

describe('when no GM is connected', () => {
  it('reports nobody online', () => {
    expect(read(null, { id: 'me' })).toEqual({ online: false, name: null, isMe: false });
  });

  it('treats a missing activeGM the same as an explicit null', () => {
    expect(read(undefined, { id: 'me' })).toEqual({ online: false, name: null, isMe: false });
  });

  it('reports nobody online when there is no game at all', () => {
    expect(readGmPresence({ getGame: () => undefined })).toEqual({
      online: false,
      name: null,
      isMe: false,
    });
  });
});

describe('when a GM is connected', () => {
  it('names the GM who will be asked', () => {
    const presence = read({ id: 'gm-1', name: 'Ana' }, { id: 'me' });

    expect(presence.online).toBe(true);
    expect(presence.name).toBe('Ana');
    expect(presence.isMe).toBe(false);
  });

  it('says it is me when I am the designated GM', () => {
    expect(read({ id: 'gm-1', name: 'Ana' }, { id: 'gm-1' }).isMe).toBe(true);
  });

  /** ⚠️ Online with no name is still online. The UI can say "a GM" without knowing which. */
  it('reports online with a null name when the GM has none', () => {
    const presence = read({ id: 'gm-1' }, { id: 'me' });

    expect(presence.online).toBe(true);
    expect(presence.name).toBeNull();
  });
});

describe('an unidentifiable client never believes it is the designated GM', () => {
  /**
   * ⚠️ This is the whole reason the comparison is not `gm.id === game.user?.id`. Both sides being
   * `undefined` makes that expression TRUE, and a client that cannot say who it is would start
   * acting on everyone else's requests.
   */
  it.each([
    ['neither side has an id', {}, {}],
    ['only the GM has an id', { id: 'gm-1' }, {}],
    ['only I have an id', {}, { id: 'me' }],
    ['my id is empty', { id: '' }, { id: '' }],
    ['there is no user at all', { id: 'gm-1' }, undefined],
  ])('is not me when %s', (_label, activeGM, user) => {
    expect(read(activeGM, user).isMe).toBe(false);
  });
});
