import { afterEach, describe, expect, it, vi } from 'vitest';

import { activity } from '../../src/bands/activityLog.js';
import type { CooClient } from '../../src/bands/CooClient.js';
import {
  buildCooClient,
  REFRESH_SETTING,
  registerBandMenus,
  startBands,
} from '../../src/bands/startBands.js';
import { FIRST_REPORT_MS, HEARTBEAT_MS, STATUS_PATH } from '../../src/bands/tongsStatus.js';

/**
 * The activity log and heartbeat as Tongs wires them (2026-10-19): what the real client records, and the
 * timers `startBands` starts.
 */
const settingsWith = (values: Record<string, unknown>) => ({
  register: vi.fn(),
  get: (_ns: string, key: string) => values[key],
  set: vi.fn(() => Promise.resolve()),
});

const texts = () => activity.entries().map((e) => e.text);

afterEach(() => {
  vi.useRealTimers();
});

describe('what the client records', () => {
  it("logs each request's path and answer, a failed one too, but never the heartbeat itself", async () => {
    const fetch = vi.fn((url: string) =>
      url.endsWith('/api/auth/pair/telegram') || url.endsWith(STATUS_PATH)
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({ status: 204, json: () => Promise.resolve({}) })
    );
    const client = buildCooClient(settingsWith({}), { fetch });

    await client.tell('/api/auth/pair', { code: 'SECRET-CODE' });
    await expect(client.tell(STATUS_PATH, { world: 'w' })).rejects.toThrow('offline');
    await expect(client.tell('/api/auth/pair/telegram', {})).rejects.toThrow('offline');

    const logged = texts();
    expect(logged).toContain('POST /api/auth/pair 204');
    expect(logged).toContain('POST /api/auth/pair/telegram unreachable');
    expect(logged.some((t) => t.includes(STATUS_PATH))).toBe(false);
    expect(logged.some((t) => t.includes('SECRET-CODE'))).toBe(false);
  });
});

describe('the heartbeat startBands starts', () => {
  it('reports from the GM soon after load and then every few minutes', () => {
    vi.useFakeTimers();
    const tell = vi.fn(() => Promise.resolve(204));
    const hooks = { on: vi.fn(() => 1), off: vi.fn() };
    const gm = { id: 'gm', role: 4, name: 'Gamemaster' };
    const globals = {
      game: {
        world: { id: 'the-grand-explorers' },
        user: gm,
        users: { activeGM: gm },
        modules: { get: () => ({ version: '0.60.0' }) },
      },
    };

    startBands(hooks, settingsWith({ [REFRESH_SETTING]: 'kept' }), globals, {
      tell,
    } as unknown as CooClient);
    vi.advanceTimersByTime(FIRST_REPORT_MS);
    vi.advanceTimersByTime(HEARTBEAT_MS);

    expect(tell).toHaveBeenCalledTimes(2);
    expect(tell).toHaveBeenCalledWith(
      STATUS_PATH,
      expect.objectContaining({ world: 'the-grand-explorers', version: '0.60.0', signedIn: true })
    );
  });
});

describe('the heartbeat from anyone else', () => {
  it('says nothing from a player, and an unknown version from a GM it cannot read it for', () => {
    vi.useFakeTimers();
    const hooks = { on: vi.fn(() => 1), off: vi.fn() };
    const gm = { id: 'gm', role: 4 };
    const run = (user: object) => {
      const tell = vi.fn(() => Promise.resolve(204));
      const globals = { game: { world: { id: 'w' }, user, users: { activeGM: gm } } };
      startBands(hooks, settingsWith({}), globals, { tell } as unknown as CooClient);
      vi.advanceTimersByTime(FIRST_REPORT_MS);
      return tell;
    };

    expect(run({ id: 'p', role: 1 })).not.toHaveBeenCalled();
    expect(run(gm)).toHaveBeenCalledWith(
      STATUS_PATH,
      expect.objectContaining({ version: 'unknown', signedIn: false })
    );
  });
});

describe('the Tongs activity menu as registered', () => {
  it('opens with the sign-in this browser keeps', async () => {
    const registerMenu = vi.fn();
    const input = vi.fn<(options: { content: string }) => Promise<unknown>>(() => Promise.resolve(null));
    class ApplicationV2 {
      public render(): unknown {
        return undefined;
      }
    }
    registerBandMenus(
      {
        registerMenu,
        get: (_ns: string, key: string) => (key === REFRESH_SETTING ? 'kept' : undefined),
      },
      {} as CooClient,
      { foundry: { applications: { api: { ApplicationV2, DialogV2: { input } } } }, game: {} }
    );

    const call = registerMenu.mock.calls.find((c) => c[1] === 'tongsActivity');
    const entry = call?.[2] as { type: new () => { render(): unknown } };
    await new entry.type().render();
    expect(input.mock.calls[0]?.[0].content).toContain('Signed in');
  });
});
