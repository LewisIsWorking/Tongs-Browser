import { describe, expect, it, vi } from 'vitest';

import { registerSignInMenu, signIn } from '../../src/bands/cooSignIn.js';
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
 * Health bands' settings, sign-in and hooks. Written 2026-09-14.
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

describe('signing in', () => {
  const client = (ok: boolean | Error) =>
    ({
      signIn: vi.fn(() => (ok instanceof Error ? Promise.reject(ok) : Promise.resolve(ok))),
    }) as unknown as CooClient & { signIn: ReturnType<typeof vi.fn> };
  const globals = (answer: unknown) => ({
    foundry: {
      applications: { api: { DialogV2: { input: vi.fn(() => Promise.resolve(answer)) } } },
    },
    ui: { notifications: { info: vi.fn(), warn: vi.fn() } },
  });

  it('hands the login to COO once, and says whether it worked', async () => {
    const accepted = client(true);
    const g = globals({ username: ' lewis ', password: 'pw' });
    expect(await signIn(accepted, g)).toBe(true);
    expect(accepted.signIn).toHaveBeenCalledWith('lewis', 'pw');
    expect(g.ui.notifications.info).toHaveBeenCalled();

    for (const refusal of [client(false), client(new Error('offline'))]) {
      const r = globals({ username: 'lewis', password: 'pw' });
      expect(await signIn(refusal, r)).toBe(false);
      expect(r.ui.notifications.warn).toHaveBeenCalled();
    }
  });

  it('does nothing when the dialog is closed, half filled, or missing', async () => {
    for (const answer of [null, { username: 'lewis' }, { username: 7, password: 'pw' }]) {
      const c = client(true);
      expect(await signIn(c, globals(answer))).toBe(false);
      expect(c.signIn).not.toHaveBeenCalled();
    }
    expect(await signIn(client(true), {})).toBe(false);
  });

  it('registers a GM-only menu whose render opens the sign-in', () => {
    const registerMenu = vi.fn();
    const g = globals(null);
    registerSignInMenu({ registerMenu }, client(true), g);
    const data = registerMenu.mock.calls[0]?.[2] as {
      restricted: boolean;
      type: new () => { render(): unknown };
    };
    expect(data.restricted).toBe(true);
    const menu = new data.type();
    expect(menu.render()).toBe(menu);
    expect(g.foundry.applications.api.DialogV2.input).toHaveBeenCalled();
    registerSignInMenu({}, client(true), g);
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
