import { describe, expect, it, vi } from 'vitest';

import { CooClient } from '../../src/bands/CooClient.js';
import type { CooClient as CooClientType, CooResponse } from '../../src/bands/CooClient.js';
import { logger } from '../../src/core/Logger.js';
import { readEncounter } from '../../src/encounter/encounterSnapshot.js';
import {
  registerEncounterSync,
  startEncounterSync,
} from '../../src/encounter/startEncounterSync.js';
import type { EncounterGlobals } from '../../src/encounter/startEncounterSync.js';
import type { LinkSettings } from '../../src/encounter/playerLinks.js';

/**
 * Encounter sync's edges: a signed-in GET, an ally no user owns, the menu opening with the world's players,
 * and a failure that is logged rather than thrown. Written 2026-09-16.
 */
class ApplicationV2 {
  public render(): unknown {
    return undefined;
  }
}

describe('a signed-in GET', () => {
  it('sends no body, and carries the access token', async () => {
    const seen: { method: string; body?: string; auth?: string }[] = [];
    const client = new CooClient({
      fetch: (url, init) => {
        seen.push({
          method: init.method,
          ...(init.body === undefined ? {} : { body: init.body }),
          auth: init.headers['Authorization'] ?? '',
        });
        const tokens = {
          accessToken: 'a1',
          refreshToken: 'r2',
          accessTokenExpiresAt: new Date(3_600_000).toISOString(),
        };
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(url.endsWith('/refresh') ? tokens : []),
        });
      },
      serverUrl: () => 'https://coo.test',
      refreshToken: () => 'r1',
      saveRefreshToken: () => Promise.resolve(),
      now: () => 0,
    });

    const response = await client.call('GET', '/api/pathwars/players');

    expect(response === 'signed-out' ? 0 : response.status).toBe(200);
    expect(seen[1]).toEqual({ method: 'GET', auth: 'Bearer a1' });
  });
});

describe('an encounter edge', () => {
  it('lists a party-alliance creature nobody owns as an ally with no player', () => {
    const turns = [{ name: 'Guard dog', actor: { alliance: 'party' } }];
    expect(
      readEncounter(
        { id: 'c1', round: 1, turn: 0, turns },
        { ryo: '1' },
        { nameVisibility: false, mystifiedName: 'x' }
      )?.allies
    ).toEqual([{ name: 'Guard dog', acted: false }]);
  });
});

describe('the Telegram players menu on a real world', () => {
  it("opens with the world's players and never its GMs", async () => {
    const registerMenu = vi.fn();
    const input = vi.fn<(options: { content: string }) => Promise<null>>(() =>
      Promise.resolve(null)
    );
    const settings: LinkSettings = {
      register: vi.fn(),
      registerMenu,
      get: () => ({}),
      set: vi.fn(),
    };
    const response: CooResponse = {
      status: 200,
      json: () => Promise.resolve([{ telegramUserId: '111', displayName: 'Ryo' }]),
    };
    const client = { call: () => Promise.resolve(response) } as unknown as CooClientType;
    registerEncounterSync(settings, client, {
      foundry: { applications: { api: { ApplicationV2, DialogV2: { input } } } },
      game: {
        users: [
          { id: 'gm', name: 'Gamemaster', isGM: true },
          { id: 'ryo', name: 'ryo yamakawa', isGM: false },
        ],
      },
    });

    const menu = registerMenu.mock.calls[0]?.[2] as { type: new () => { render(): unknown } };
    new menu.type().render();
    await vi.waitFor(() => {
      expect(input).toHaveBeenCalled();
    });
    const content = input.mock.calls[0]?.[0].content ?? '';
    expect(content).toContain('ryo yamakawa');
    expect(content).not.toContain('Gamemaster');
  });
});

describe('a failing post', () => {
  it('is logged, never thrown into Foundry', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const combat = {
      id: 'c1',
      round: 1,
      turn: 0,
      turns: [],
      combatants: {
        contents: [{ actor: { uuid: 'Actor.PC', type: 'character', hasPlayerOwner: true } }],
      },
    };
    const globals = {
      game: {
        user: { id: 'gm', role: 4, isGM: true },
        users: { activeGM: { id: 'gm', role: 4 } },
        actors: [
          {
            type: 'party',
            uuid: 'Actor.P',
            name: 'P',
            getFlag: () => 'C09',
            system: { details: { members: [{ uuid: 'Actor.PC' }] } },
          },
        ],
        combats: { contents: [combat] },
      },
    } as unknown as EncounterGlobals;
    const settings: LinkSettings = {
      register: vi.fn(),
      get: (_s, key) => key === 'syncEncounters',
      set: vi.fn(),
    };
    const client = {
      call: () => Promise.reject(new Error('network down')),
    } as unknown as CooClientType;

    startEncounterSync({ on: () => 0 }, settings, globals, client);

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith('Encounter sync on load failed: network down');
    });
    warn.mockRestore();
  });

  it('logs a failure that is not an Error, and starts on a world with no encounters', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const settings: LinkSettings = {
      register: vi.fn(),
      get: (_s, key) => key === 'syncEncounters',
      set: vi.fn(),
    };
    const handlers = new Map<string, (...args: never[]) => unknown>();
    const hooks = {
      on: (name: string, fn: (...args: never[]) => unknown) => {
        handlers.set(name, fn);
        return 0;
      },
    };
    const client = { call: () => Promise.reject(new Error('x')) } as unknown as CooClientType;
    const sync = startEncounterSync(hooks, settings, { game: {} }, client);
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a non-Error rejection is the case
    vi.spyOn(sync, 'changed').mockReturnValue(Promise.reject('plain words'));

    handlers.get('deleteCombat')?.({ id: 'c1' } as never);

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith('Encounter sync on an ending failed: plain words');
    });
    warn.mockRestore();
  });
});
