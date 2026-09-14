import { describe, expect, it, vi } from 'vitest';

import type { CooClient } from '../../src/bands/CooClient.js';
import {
  CAMPAIGN_SETTING,
  DEFAULT_SERVER,
  REFRESH_SETTING,
  SERVER_SETTING,
  buildCooClient,
  registerBandSettings,
  startBands,
} from '../../src/bands/startBands.js';
import { logger } from '../../src/core/Logger.js';

/**
 * Health bands' settings and hooks. Written 2026-09-14. Signing in is in `cooSignIn.test.ts`.
 */
const settingsWith = (values: Record<string, unknown>) => ({
  register: vi.fn(),
  get: (_ns: string, key: string) => values[key],
  set: vi.fn((_ns: string, key: string, value: unknown) => {
    values[key] = value;
    return Promise.resolve();
  }),
});

describe('settings', () => {
  it('registers the campaign for the world, and the server and hidden session for this browser only', () => {
    const settings = settingsWith({});
    registerBandSettings(settings);
    const scopes = Object.fromEntries(
      settings.register.mock.calls.map(([, key, data]) => [key, [data.scope, data.config]])
    );
    expect(scopes).toEqual({
      [CAMPAIGN_SETTING]: ['world', true],
      [SERVER_SETTING]: ['client', true],
      [REFRESH_SETTING]: ['client', false],
    });
  });

  it('builds a client on the configured server that keeps its session in the setting', async () => {
    const values: Record<string, unknown> = { [SERVER_SETTING]: ' ', [REFRESH_SETTING]: 'r1' };
    const fetch = vi.fn((url: string) =>
      Promise.resolve({
        status: url.endsWith('refresh') ? 200 : 200,
        json: () =>
          Promise.resolve({
            accessToken: 'a',
            refreshToken: 'r2',
            accessTokenExpiresAt: '2999-01-01T00:00:00Z',
          }),
      })
    );
    const client = buildCooClient(settingsWith(values), { fetch });

    expect(
      await client.postBand('C06', {
        name: 'G',
        segments: 1,
        word: 'w',
        hp: 1,
        maxHp: 9,
        announce: false,
      })
    ).toBe('sent');
    expect(fetch.mock.calls[0]?.[0]).toBe(`${DEFAULT_SERVER}/api/auth/refresh`);
    expect(values[REFRESH_SETTING]).toBe('r2');
    await client.postBand('C06', {
      name: 'G',
      segments: 1,
      word: 'w',
      hp: 2,
      maxHp: 9,
      announce: false,
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    await expect(
      buildCooClient(settingsWith({ [REFRESH_SETTING]: 'r' }), {}).postBand('C06', {
        name: 'G',
        segments: 1,
        word: 'w',
        hp: 1,
        maxHp: 9,
        announce: false,
      })
    ).rejects.toThrow('cannot make requests');
    expect(
      await buildCooClient(settingsWith({ [SERVER_SETTING]: 7 }), { fetch }).postBand('C06', {
        name: 'G',
        segments: 1,
        word: 'w',
        hp: 1,
        maxHp: 9,
        announce: false,
      })
    ).toBe('signed-out');
  });
});

describe('hooks', () => {
  it('reports HP changes, seeds on scene and combat changes, and logs a failure', async () => {
    const handlers = new Map<string, ((...args: unknown[]) => void)[]>();
    const hooks = {
      on(this: unknown, name: string, fn: (...args: never[]) => unknown) {
        handlers.set(name, [...(handlers.get(name) ?? []), fn as (...args: unknown[]) => void]);
        return handlers.size;
      },
    };
    const globals = {
      game: { user: { id: 'gm', role: 4 }, users: { activeGM: { id: 'gm', role: 4 } } },
    };
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const reporter = startBands(
      hooks,
      settingsWith({ [CAMPAIGN_SETTING]: ' C06 ' }),
      globals,
      {} as CooClient
    );
    expect([...handlers.keys()].sort()).toEqual([
      'canvasReady',
      'createCombatant',
      'updateActor',
      'updateCombat',
    ]);

    const seed = vi.spyOn(reporter, 'seed');
    handlers.get('canvasReady')?.forEach((fn) => {
      fn();
    });
    expect(seed).toHaveBeenCalled();
    vi.spyOn(reporter, 'onActorUpdated')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce('bang');
    handlers.get('updateActor')?.forEach((fn) => {
      fn({}, {});
      fn({}, {});
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warn).toHaveBeenCalledWith('Health bands failed: boom');
    expect(warn).toHaveBeenCalledWith('Health bands failed: bang');
    warn.mockRestore();
  });
});
