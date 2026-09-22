import { describe, expect, it, vi } from 'vitest';

import { registerWorldSwaps, startWorldSwaps } from '../../src/swaps/startWorldSwaps.js';
import type { SwapGlobals } from '../../src/swaps/startWorldSwaps.js';
import type { CooClient } from '../../src/bands/CooClient.js';
import { logger } from '../../src/core/Logger.js';
import { table } from './support/worldSwapTable.js';

/**
 * World swaps connected to Foundry: the setting, the timer, the dialog and the GM check. Written 2026-09-20.
 *
 * The timer is a fake the test fires by hand, so "beats" is asserted from the call the heartbeat made.
 */
describe('the world-swap setting', () => {
  /* ⛔ Default TRUE, the opposite of every other automation: off is what lets a swap close a live world. */
  it('is registered per world and on by default', () => {
    const settings = { register: vi.fn(), get: vi.fn() };

    registerWorldSwaps(settings);

    expect(settings.register).toHaveBeenCalledWith(
      'tongs-browser',
      'approveWorldSwaps',
      expect.objectContaining({ scope: 'world', config: true, default: true })
    );
  });
});

describe('the heartbeat in a real browser', () => {
  it('beats for the world this GM has open, and stops when told to', async () => {
    const live = table({});

    await live.tick();
    live.stop();

    expect(live.calls).toEqual([
      { path: '/api/foundry/presence', body: { worldId: 'doomsday-funtime' } },
    ]);
  });

  it('says nothing to COO while the setting is off', async () => {
    const off = table({ on: false });

    await off.tick();

    expect(off.calls).toEqual([]);
  });

  /* ⛔ Exactly one browser answers: an Assistant GM, or a GM watching from a second tab, must not. */
  it('stays quiet in a browser that is not the acting GM', async () => {
    const assistant = table({ activeGm: { id: 'gm1', role: 3 } });
    const otherTab = table({ me: { id: 'gm2', role: 4 } });

    await assistant.tick();
    await otherTab.tick();

    expect(assistant.calls).toEqual([]);
    expect(otherTab.calls).toEqual([]);
  });

  it('beats for nothing when Foundry has no world id to give', async () => {
    const noWorld = table({ world: 7 });

    await noWorld.tick();

    expect(noWorld.calls).toEqual([]);
  });

  /* ⚠️ A timer callback that rejects is an unhandled rejection, which in Foundry is a red banner. */
  it('logs a heartbeat that threw rather than letting it escape the timer', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const broken = table({ throws: true });

    await broken.tick();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('COO is unreachable'));
    warn.mockRestore();
  });

  /* ⚠️ Not everything thrown in a browser is an Error: a bare string must still reach the log. */
  it('logs a heartbeat that threw something other than an Error', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const odd = table({ throwValue: 'the gateway went away' });

    await odd.tick();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('the gateway went away'));
    warn.mockRestore();
  });
});

describe('what the GM is asked', () => {
  const pending = [
    { id: 'r1', state: 'AwaitingGm', requester: 'Riley', from: 'doomsday-funtime', to: '3' },
  ];

  it('opens one dialog naming the player and the world, and sends the yes', async () => {
    const asked = table({ pending });

    await asked.tick();

    expect(asked.confirms[0]?.content).toContain('Riley');
    expect(asked.calls[1]).toEqual({
      path: '/api/foundry/swap/r1/decision',
      body: { approve: true },
    });
  });

  /* ⚠️ A dialog the GM closed, or that failed to open, is a NO: their world stays open. */
  it('treats a closed or missing dialog as keeping this world', async () => {
    const closed = table({ pending, confirm: () => Promise.resolve(null) });
    const thrown = table({ pending, confirm: () => Promise.reject(new Error('closed')) });

    await closed.tick();
    await thrown.tick();

    expect(closed.calls[1]?.body).toEqual({ approve: false });
    expect(thrown.calls[1]?.body).toEqual({ approve: false });
  });

  it('warns the GM at the table when COO never heard the answer', async () => {
    const lost = table({ pending, decisionStatus: 503 });

    await lost.tick();

    expect(lost.warnings[0]).toContain('Riley');
  });
});

describe('the timer it makes for itself', () => {
  /* ⚠️ The injected timer is what every other test uses, so the REAL one is only exercised here. */
  it('beats every 30 seconds until it is stopped', () => {
    vi.useFakeTimers();
    const paths: string[] = [];
    const gm = { id: 'gm1', role: 4 };
    const settings = { register: vi.fn(), get: () => true };
    const globals = {
      game: { user: gm, users: { activeGM: gm }, world: { id: 'doomsday-funtime' } },
    } as unknown as SwapGlobals;
    const client = {
      call: (_method: 'GET' | 'POST', path: string) => {
        paths.push(path);
        return Promise.resolve({ status: 200, json: () => Promise.resolve({}) });
      },
    } as unknown as CooClient;

    const stop = startWorldSwaps(settings, globals, client);
    vi.advanceTimersByTime(60_000);
    stop();
    vi.advanceTimersByTime(60_000);

    expect(paths).toEqual(['/api/foundry/presence', '/api/foundry/presence']);
    vi.useRealTimers();
  });
});
