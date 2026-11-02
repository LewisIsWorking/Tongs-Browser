import { describe, expect, it, vi } from 'vitest';

import {
  postBreather,
  readBreatherFlag,
  startBreatherPosts,
} from '../../src/breather/breatherPost.js';
import type { PostGlobals } from '../../src/breather/breatherPost.js';

/**
 * Each No-Limit Stamina breather, told to the character's campaign's combat topic, 2026-11-02. Lewis: "Could the
 * macro always post to that campaign's combat topic regardless of if they are in combat?" C00 and C01 share a
 * world, so the campaign is the one whose party lists the character.
 */
const party = (uuid: string, code: string, members: string[]) => ({
  type: 'party',
  uuid,
  name: `Party ${code}`,
  getFlag: () => code,
  system: { details: { members: members.map((member) => ({ uuid: member })) } },
});

const card = (over: Record<string, unknown> = {}) => ({
  flags: {
    'tongs-browser': {
      breather: {
        actorUuid: 'Actor.kibwe',
        name: 'Kibwe',
        spBefore: 3,
        maxSp: 20,
        img: 'tokens/kibwe.webp',
        ...over,
      },
    },
  },
});

const world = (options: { role?: number; me?: string } = {}) => {
  const actors = [
    party('Actor.P0', 'C00', ['Actor.lai']),
    party('Actor.P1', 'C01', ['Actor.kibwe']),
  ];
  const globals = {
    game: {
      user: { id: options.me ?? 'gm', role: options.role ?? 4, isGM: true },
      users: { activeGM: { id: 'gm', role: 4 } },
      actors: Object.assign(actors, { party: undefined }),
    },
    location: { href: 'https://foundry.cooserver.duckdns.org/game' },
    fromUuidSync: (uuid: string) => ({ uuid, name: uuid.slice(6) }),
  } as unknown as PostGlobals;
  const call = vi.fn(async () => Promise.resolve({ status: 200 }));
  return { globals, call, client: { call } as never };
};

describe('the breather post', () => {
  it("goes to the character's own campaign, with no encounter running, and its picture", async () => {
    const w = world();
    expect(await postBreather(card(), w.globals, w.client)).toBe('C01 200');
    expect(w.call).toHaveBeenCalledWith('POST', '/api/pathwars/campaigns/C01/breather', {
      name: 'Kibwe',
      spBefore: 3,
      maxSp: 20,
      characterImage: 'https://foundry.cooserver.duckdns.org/tokens/kibwe.webp',
    });
    expect(
      await postBreather(card({ actorUuid: 'Actor.lai', img: null }), w.globals, w.client)
    ).toBe('C00 200');
    expect(w.call).toHaveBeenLastCalledWith('POST', '/api/pathwars/campaigns/C00/breather', {
      name: 'Kibwe',
      spBefore: 3,
      maxSp: 20,
    });
  });

  it('is posted only by the active full GM', async () => {
    for (const options of [{ role: 1 }, { me: 'other' }]) {
      const w = world(options);
      expect(await postBreather(card(), w.globals, w.client)).toBe('not ours');
      expect(w.call).not.toHaveBeenCalled();
    }
  });

  it('posts nothing for a character no party with a campaign lists', async () => {
    const w = world();
    expect(await postBreather(card({ actorUuid: 'Actor.nobody' }), w.globals, w.client)).toBe(
      'no campaign for Kibwe'
    );
    expect(w.call).not.toHaveBeenCalled();
  });

  it('says when the GM is signed out', async () => {
    const w = world();
    w.call.mockResolvedValueOnce('signed-out' as never);
    expect(await postBreather(card(), w.globals, w.client)).toBe('signed out');
  });

  it('ignores every other message, and a malformed flag', () => {
    expect(readBreatherFlag({})).toBeNull();
    expect(readBreatherFlag(null)).toBeNull();
    expect(readBreatherFlag(card({ maxSp: '20' }))).toBeNull();
    expect(readBreatherFlag(card({ spBefore: undefined }))).toBeNull();
    expect(readBreatherFlag(card({ name: 7 }))).toBeNull();
    expect(readBreatherFlag(card({ actorUuid: null }))).toBeNull();
    expect(readBreatherFlag(card({ img: 5 }))).toMatchObject({ img: null });
  });

  it('listens to every chat card, logging what it did and any failure', async () => {
    const w = world();
    const handlers: ((message: unknown) => unknown)[] = [];
    const info = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    startBreatherPosts({ on: (_name, fn) => handlers.push(fn) }, w.globals, w.client);
    handlers[0]?.({});
    handlers[0]?.(card());
    await vi.waitFor(() => {
      expect(String(info.mock.calls.at(-1))).toContain('Breather to the combat topic: C01 200.');
    });
    expect(info).toHaveBeenCalledTimes(1);
    w.call.mockRejectedValueOnce(new Error('offline'));
    handlers[0]?.(card());
    w.call.mockRejectedValueOnce('odd');
    handlers[0]?.(card());
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledTimes(2);
    });
    expect(String(warn.mock.calls[0])).toContain('Breather post failed: offline');
    expect(String(warn.mock.calls[1])).toContain('Breather post failed: odd');
    info.mockRestore();
    warn.mockRestore();
  });
});
