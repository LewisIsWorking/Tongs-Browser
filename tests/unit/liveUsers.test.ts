import { describe, expect, it, vi } from 'vitest';

import { addLiveUsers, foundryCreateUser, liveUsersOf } from '../../src/swaps/LiveUsers.js';
import type { LiveUser } from '../../src/swaps/LiveUsers.js';
import { WorldSwapGm } from '../../src/swaps/WorldSwapGm.js';
import type { WorldSwapPorts } from '../../src/swaps/WorldSwapGm.js';

/**
 * Adding a player to the running world without a restart, on the GM's side. Written 2026-09-26.
 * The fake COO answers the heartbeat with `createUsers` exactly as `POST api/foundry/presence` does.
 */
const ryo: LiveUser = {
  id: 'RyoRyoRyoRyoRyo1',
  name: 'Ryo',
  role: 1,
  password: 'one-time-password-123',
};

describe('reading the players COO wants added', () => {
  it('keeps well-formed rows and drops anything else, never throwing', () => {
    const body = {
      createUsers: [
        ryo,
        { ...ryo, id: 'short' },
        { ...ryo, role: 9 },
        { ...ryo, password: 'tiny' },
        { ...ryo, name: '' },
        null,
        'junk',
      ],
    };
    expect(liveUsersOf(body)).toEqual([ryo]);
    expect(liveUsersOf({})).toEqual([]);
    expect(liveUsersOf(null)).toEqual([]);
  });
});

describe('adding them', () => {
  it('confirms only the players it actually created', async () => {
    const eve = { ...ryo, id: 'EveEveEveEveEve1', name: 'Eve' };
    const call = vi.fn(() => Promise.resolve({ status: 200, json: () => Promise.resolve({}) }));
    const create = vi.fn((u: LiveUser) =>
      u.id === ryo.id ? Promise.resolve(true) : Promise.reject(new Error('no'))
    );

    expect(await addLiveUsers('w2', [ryo, eve], create, call)).toBe(1);
    expect(call).toHaveBeenCalledWith('POST', '/api/foundry/live-users/created', {
      worldId: 'w2',
      ids: [ryo.id],
    });
  });

  it('tells COO nothing when nothing was created', async () => {
    const call = vi.fn();
    expect(await addLiveUsers('w2', [ryo], () => Promise.resolve(false), call)).toBe(0);
    expect(call).not.toHaveBeenCalled();
  });

  it("creates with COO's exact id, or sets the password on a user who already exists", async () => {
    const create = vi.fn(() => Promise.resolve({ id: ryo.id }));
    const made = foundryCreateUser({
      game: { users: { get: () => undefined } },
      CONFIG: { User: { documentClass: { create } } },
    });
    expect(await made(ryo)).toBe(true);
    expect(create).toHaveBeenCalledWith(
      { _id: ryo.id, name: 'Ryo', role: 1, password: ryo.password },
      { keepId: true }
    );

    const update = vi.fn(() => Promise.resolve());
    const reset = foundryCreateUser({ game: { users: { get: () => ({ update }) } } });
    expect(await reset(ryo)).toBe(true);
    expect(update).toHaveBeenCalledWith({ password: ryo.password });

    expect(await foundryCreateUser({})(ryo)).toBe(false);
  });
});

describe('the heartbeat with live-add and the idle clock', () => {
  const beat = (reply: object, over: Partial<WorldSwapPorts>) => {
    const calls: { path: string; body?: object }[] = [];
    const ports: WorldSwapPorts = {
      isGm: () => true,
      worldId: () => 'w2',
      call: vi.fn((_m: 'GET' | 'POST', path: string, body?: object) => {
        calls.push({ path, ...(body === undefined ? {} : { body }) });
        return Promise.resolve({ status: 200, json: () => Promise.resolve(reply) });
      }),
      ask: () => Promise.resolve(false),
      notify: () => undefined,
      ...over,
    };
    return { run: () => new WorldSwapGm(ports).beat(), calls };
  };

  it('reports idle time and live support, then creates and confirms what COO sends', async () => {
    const created: string[] = [];
    const { run, calls } = beat(
      { pending: [], createUsers: [ryo] },
      {
        idleSeconds: () => 42.6,
        createUser: (u) => {
          created.push(u.id);
          return Promise.resolve(true);
        },
      }
    );

    expect(await run()).toBe('beat');
    expect(calls[0]).toEqual({
      path: '/api/foundry/presence',
      body: { worldId: 'w2', idleSeconds: 43, liveUsers: true },
    });
    expect(created).toEqual([ryo.id]);
    expect(calls[1]).toEqual({
      path: '/api/foundry/live-users/created',
      body: { worldId: 'w2', ids: [ryo.id] },
    });
  });

  it('without those abilities, says only which world it is in and creates nobody', async () => {
    const { run, calls } = beat({ pending: [], createUsers: [ryo] }, {});
    await run();
    expect(calls).toEqual([{ path: '/api/foundry/presence', body: { worldId: 'w2' } }]);
  });
});
