import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CooClient, CooResponse } from '../../src/bands/CooClient.js';
import {
  registerEncounterSync,
  startEncounterSync,
} from '../../src/encounter/startEncounterSync.js';
import type { EncounterGlobals } from '../../src/encounter/startEncounterSync.js';
import type { LinkSettings } from '../../src/encounter/playerLinks.js';

/**
 * Encounter sync connected to Foundry's hooks, through the real reader, sync and client call. Written 2026-09-16.
 */
afterEach(() => {
  vi.useRealTimers();
});

const world = (
  on = true,
  response: CooResponse | 'signed-out' = {
    status: 200,
    json: () => Promise.resolve({ trackerMessageId: 9001 }),
  }
) => {
  const handlers = new Map<string, (...args: never[]) => unknown>();
  const hooks = {
    on: (name: string, fn: (...args: never[]) => unknown) => {
      handlers.set(name, fn);
      return handlers.size;
    },
  };
  const settings: LinkSettings = {
    register: vi.fn(),
    registerMenu: vi.fn(),
    get: (_scope, key) =>
      key === 'syncEncounters' ? on : key === 'playerLinks' ? { ryo: '111' } : undefined,
    set: vi.fn(() => Promise.resolve()),
  };
  const flags = new Map<string, unknown>();
  const combat = {
    id: 'c1',
    round: 1,
    turn: 0,
    turns: [{ name: 'Arktos', actor: { hasPlayerOwner: true, ownership: { ryo: 3 } } }],
    combatants: {
      contents: [{ actor: { uuid: 'Actor.PC', type: 'character', hasPlayerOwner: true } }],
    },
    getFlag: (_scope: string, key: string) => flags.get(key),
    setFlag: vi.fn((_scope: string, key: string, value: unknown) => {
      flags.set(key, value);
      return Promise.resolve();
    }),
  };
  const globals = {
    game: {
      user: { id: 'gm', role: 4, isGM: true },
      users: { activeGM: { id: 'gm', role: 4 } },
      actors: [
        {
          type: 'party',
          uuid: 'Actor.Party',
          name: 'Party',
          getFlag: () => 'C09',
          system: { details: { members: [{ uuid: 'Actor.PC' }] } },
        },
      ],
      combats: { contents: [combat] },
    },
  } as unknown as EncounterGlobals;
  const call = vi.fn(() => Promise.resolve(response));
  const client = { call } as unknown as CooClient;
  return { handlers, hooks, settings, globals, client, call, combat, flags };
};

describe('encounter sync on Foundry hooks', () => {
  it('re-sends running encounters on load, and keeps the tracker id COO answers on the combat', async () => {
    const w = world();
    startEncounterSync(w.hooks, w.settings, w.globals, w.client);

    await vi.waitFor(() => {
      expect(w.flags.get('trackerMessageId')).toBe(9001);
    });
    expect(w.call).toHaveBeenCalledWith('POST', '/api/pathwars/campaigns/C09/encounter', {
      encounterId: 'c1',
      round: 1,
      allies: [{ name: 'Arktos', acted: false, telegramUserId: '111' }],
      enemies: [],
      ended: false,
    });
  });

  /* ⛔ Saving the tracker id is itself a combat update; counting it would post forever. */
  it('counts a turn, a combatant change and an ending, never a flag-only update', async () => {
    vi.useFakeTimers();
    const w = world();
    startEncounterSync(w.hooks, w.settings, w.globals, w.client);
    await vi.runAllTimersAsync();
    w.call.mockClear();

    w.handlers.get('updateCombat')?.(w.combat as never, { flags: { x: 1 } } as never);
    w.handlers.get('updateCombatant')?.({ parent: w.combat } as never, { img: 'x' } as never);
    w.handlers.get('createCombatant')?.({ parent: null } as never);
    await vi.runAllTimersAsync();
    expect(w.call).not.toHaveBeenCalled();

    w.handlers.get('updateCombat')?.(w.combat as never, { turn: 1 } as never);
    w.handlers.get('updateCombatant')?.({ parent: w.combat } as never, { defeated: true } as never);
    await vi.runAllTimersAsync();
    expect(w.call).toHaveBeenCalledTimes(1);

    w.handlers.get('deleteCombat')?.(w.combat as never);
    await vi.runAllTimersAsync();
    expect(w.call).toHaveBeenLastCalledWith(
      'POST',
      expect.any(String),
      expect.objectContaining({ ended: true, trackerMessageId: 9001 })
    );
  });

  it('does nothing while the setting is off, and keeps no id when COO refuses or the GM is signed out', async () => {
    const off = world(false);
    startEncounterSync(off.hooks, off.settings, off.globals, off.client);
    off.handlers.get('deleteCombat')?.(off.combat as never);
    expect(off.call).not.toHaveBeenCalled();

    for (const response of [
      { status: 500, json: () => Promise.resolve({}) },
      'signed-out' as const,
    ]) {
      const w = world(true, response);
      startEncounterSync(w.hooks, w.settings, w.globals, w.client);
      await vi.waitFor(() => {
        expect(w.call).toHaveBeenCalled();
      });
      expect(w.combat.setFlag).not.toHaveBeenCalled();
    }
  });

  it('registers its setting, the saved links and the GM menu at init', () => {
    const w = world();
    registerEncounterSync(w.settings, w.client, {});
    expect(w.settings.register).toHaveBeenCalledWith(
      'tongs-browser',
      'syncEncounters',
      expect.objectContaining({ default: false })
    );
    expect(w.settings.register).toHaveBeenCalledWith(
      'tongs-browser',
      'playerLinks',
      expect.objectContaining({ config: false })
    );
  });
});
