import { describe, expect, it, vi } from 'vitest';

import {
  CALL_GAP_MS,
  HelperCall,
  WAITING_PATH,
  queuedSomething,
  startHelperCall,
} from '../../src/helper/startHelperCall.js';
import type { HelperCallPorts, HelperGlobals } from '../../src/helper/startHelperCall.js';

/** Calling COO's helper GM when this browser queues work and no GM is online. 2026-10-10. */
const request = { flags: { 'tongs-browser': { sheetRequest: { id: 'r1', name: 'Lai', at: 1 } } } };
const pendingCard = { flags: { 'tongs-browser': { pending: true } } };

function setup(overrides: Partial<HelperCallPorts> = {}) {
  let now = 1_000_000;
  const tell = vi.fn(() => Promise.resolve(200));
  const call = new HelperCall({
    myId: () => 'me',
    queues: () => true,
    worldId: () => 'c07',
    tell,
    now: () => now,
    ...overrides,
  });
  return { call, tell, wait: (ms: number) => (now += ms) };
}

describe('what counts as queued work', () => {
  it('is a sheet request or a pending card, and nothing else', () => {
    expect(queuedSomething(request)).toBe(true);
    expect(queuedSomething(pendingCard)).toBe(true);
    expect(queuedSomething({ flags: { 'tongs-browser': { pending: false } } })).toBe(false);
    expect(queuedSomething({ flags: { 'tongs-browser': { sheetResult: {} } } })).toBe(false);
    expect(queuedSomething({ flags: { other: { pending: true } } })).toBe(false);
    expect(queuedSomething(undefined)).toBe(false);
  });
});

describe('calling the helper', () => {
  it('names the world when this browser queues work with no GM online', async () => {
    const { call, tell } = setup();
    await call.onWrite(request, 'me');
    expect(tell).toHaveBeenCalledWith(WAITING_PATH, { world: 'c07' });
  });

  it("ignores another user's write, so one queued card is one call", async () => {
    const { call, tell } = setup();
    await call.onWrite(pendingCard, 'someone-else');
    expect(tell).not.toHaveBeenCalled();
  });

  it('stays quiet while a GM is online to do the work', async () => {
    const { call, tell } = setup({ queues: () => false });
    await call.onWrite(request, 'me');
    expect(tell).not.toHaveBeenCalled();
  });

  it('calls at most once a minute', async () => {
    const { call, tell, wait } = setup();
    await call.onWrite(request, 'me');
    wait(CALL_GAP_MS - 1);
    await call.onWrite(pendingCard, 'me');
    expect(tell).toHaveBeenCalledTimes(1);
    wait(1);
    await call.onWrite(pendingCard, 'me');
    expect(tell).toHaveBeenCalledTimes(2);
  });

  it('does not call without a world id', async () => {
    const { call, tell } = setup({ worldId: () => undefined });
    await call.onWrite(request, 'me');
    expect(tell).not.toHaveBeenCalled();
  });
});

describe('the Foundry wiring', () => {
  it("calls from Foundry's update and create hooks, and gives the helper its reading", async () => {
    const handlers = new Map<string, (...args: never[]) => unknown>();
    const hooks = {
      on: (name: string, fn: (...args: never[]) => unknown) => handlers.set(name, fn),
    };
    const tell = vi.fn(() => Promise.resolve(200));
    const entry: { helper?: { waiting(): string[] } } = {};
    const globals = {
      game: {
        user: { id: 'me', role: 1, isGM: false },
        users: { activeGM: null },
        world: { id: 'c02' },
      },
    } as unknown as HelperGlobals;

    startHelperCall(hooks, globals, tell, entry);
    (handlers.get('createChatMessage') as ((...args: unknown[]) => unknown) | undefined)?.(
      pendingCard,
      {},
      'me'
    );
    await Promise.resolve();

    expect(tell).toHaveBeenCalledWith(WAITING_PATH, { world: 'c02' });
    expect(entry.helper?.waiting()).toEqual([]);
    /* The helper is not signed in to COO, so it is handed playerCampaigns; with no store wired, a no-op. */
    await expect(
      (entry.helper as unknown as { campaigns(map: object): Promise<void> }).campaigns({})
    ).resolves.toBeUndefined();
    expect([...handlers.keys()].sort()).toEqual([
      'createChatMessage',
      'updateChatMessage',
      'updateUser',
    ]);
  });
});

describe('every hook, and a COO that is down', () => {
  it('calls from a user or message update too, and swallows a failed call', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const hooks = {
      on: (name: string, fn: (...args: never[]) => unknown) =>
        handlers.set(name, fn as (...args: unknown[]) => unknown),
    };
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => (now += CALL_GAP_MS));
    const tell = vi.fn(() => Promise.reject(new Error('COO is down')));
    const globals = {
      game: {
        user: { id: 'me', role: 1, isGM: false },
        users: { activeGM: null },
        world: { id: 'c07' },
      },
    } as unknown as HelperGlobals;

    startHelperCall(hooks, globals, tell, undefined);
    handlers.get('updateUser')?.({}, request, {}, 'me');
    handlers.get('updateChatMessage')?.({}, pendingCard, {}, 'me');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(tell).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
});

describe("the helper's playerCampaigns", () => {
  it('stores the map COO hands the helper (2026-10-10)', async () => {
    const store = vi.fn(async () => Promise.resolve());
    const entry: { helper?: { campaigns(map: object): Promise<void> } } = {};
    const hooks = { on: () => undefined };
    startHelperCall(hooks, {} as HelperGlobals, vi.fn(), entry, store);
    await entry.helper?.campaigns({ AnnAnnAnnAnnAnn1: ['C07'] });
    expect(store).toHaveBeenCalledWith({ AnnAnnAnnAnnAnn1: ['C07'] });
  });
});
