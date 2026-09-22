import { describe, expect, it, vi } from 'vitest';

import { pendingOf, WorldSwapGm } from '../../src/swaps/WorldSwapGm.js';
import type { SwapRequestView, WorldSwapPorts } from '../../src/swaps/WorldSwapGm.js';
import { swapPrompt } from '../../src/swaps/startWorldSwaps.js';

/**
 * The GM's half of world swapping. Written 2026-09-20.
 *
 * The fake COO answers a heartbeat with whatever `pending` the test sets, which is the shape the real
 * `POST api/foundry/presence` returns, so "asked once" and "answered" are asserted from the calls made.
 */
const waiting = (id: string, over: Partial<SwapRequestView> = {}) => ({
  id,
  requester: 'Riley',
  from: 'doomsday-funtime',
  to: 'the-grand-explorers',
  state: 'AwaitingGm',
  ...over,
});

const harness = (pending: unknown[] = [], over: Partial<WorldSwapPorts> = {}, status = 200) => {
  const calls: { path: string; body?: object }[] = [];
  const notices: string[] = [];
  const ports: WorldSwapPorts = {
    isGm: () => true,
    worldId: () => 'doomsday-funtime',
    call: vi.fn((_method: 'GET' | 'POST', path: string, body?: object) => {
      calls.push({ path, ...(body === undefined ? {} : { body }) });
      return Promise.resolve({ status, json: () => Promise.resolve({ pending }) });
    }),
    ask: () => Promise.resolve(true),
    notify: (message) => notices.push(message),
    ...over,
  };
  return { gm: new WorldSwapGm(ports), ports, calls, notices };
};

describe('the GM heartbeat', () => {
  it('tells COO which world it is in, and answers what is waiting on it', async () => {
    const asked: string[] = [];
    const { gm, calls } = harness([waiting('r1')], {
      ask: (request) => {
        asked.push(request.requester);
        return Promise.resolve(true);
      },
    });

    await expect(gm.beat()).resolves.toBe('beat');

    expect(calls[0]).toEqual({
      path: '/api/foundry/presence',
      body: { worldId: 'doomsday-funtime' },
    });
    expect(asked).toEqual(['Riley']);
    expect(calls[1]).toEqual({
      path: '/api/foundry/swap/r1/decision',
      body: { approve: true },
    });
  });

  it('sends the refusal, not silence, when the GM says no', async () => {
    const { gm, calls } = harness([waiting('r1')], { ask: () => Promise.resolve(false) });

    await gm.beat();

    expect(calls[1]?.body).toEqual({ approve: false });
  });

  /* ⛔ The same request comes back in every heartbeat until COO forgets it; a second dialog would stack. */
  it('asks once for a request that keeps coming back, including after it was decided', async () => {
    const ask = vi.fn(() => Promise.resolve(true));
    const { gm } = harness([waiting('r1')], { ask });

    await gm.beat();
    await gm.beat();
    await gm.beat();

    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('offers a request again when the decision never reached COO, and says so', async () => {
    const ask = vi.fn(() => Promise.resolve(true));
    let decisions = 0;
    const { gm, notices } = harness([waiting('r1')], {
      ask,
      call: (_method, path, body) => {
        if (path.endsWith('/decision')) {
          decisions += 1;
          return Promise.resolve({ status: 500, json: () => Promise.resolve({}) });
        }
        void body;
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ pending: [waiting('r1')] }),
        });
      },
    });

    await gm.beat();
    await gm.beat();

    expect(ask).toHaveBeenCalledTimes(2);
    expect(decisions).toBe(2);
    expect(notices[0]).toContain('Riley');
  });

  it('does nothing at all in a browser that is not the acting GM, or has no world open', async () => {
    const notGm = harness([waiting('r1')], { isGm: () => false });
    const noWorld = harness([waiting('r1')], { worldId: () => '' });

    await expect(notGm.gm.beat()).resolves.toBe('not-gm');
    await expect(noWorld.gm.beat()).resolves.toBe('no-world');
    expect(notGm.calls).toEqual([]);
    expect(noWorld.calls).toEqual([]);
  });

  it('reports a signed-out or refusing COO rather than throwing at the table', async () => {
    const out = harness([], { call: () => Promise.resolve('signed-out' as const) });
    const refused = harness([], {}, 403);

    await expect(out.gm.beat()).resolves.toBe('signed-out');
    await expect(refused.gm.beat()).resolves.toBe('failed');
  });

  it('leaves alone anything not waiting for this GM', async () => {
    const ask = vi.fn(() => Promise.resolve(true));
    const { gm } = harness(
      [waiting('r1', { state: 'Switching' }), waiting('r2', { state: 'Done' })],
      {
        ask,
      }
    );

    await gm.beat();

    expect(ask).not.toHaveBeenCalled();
  });
});

describe('reading what COO sent', () => {
  it('keeps the rows it can use and drops the ones it cannot, rather than throwing', () => {
    const views = pendingOf({
      pending: [
        waiting('r1', { message: 'Session starts at 7' }),
        { id: '', state: 'AwaitingGm' },
        { id: 'r3' },
        null,
        { id: 'r4', state: 'AwaitingGm' },
      ],
    });

    expect(views.map((v) => v.id)).toEqual(['r1', 'r4']);
    expect(views[0]?.message).toBe('Session starts at 7');
    expect(views[1]).toEqual({
      id: 'r4',
      requester: 'A player',
      from: '',
      to: '',
      state: 'AwaitingGm',
    });
  });

  it('answers nothing for a body that is not a request list', () => {
    expect(pendingOf(null)).toEqual([]);
    expect(pendingOf({})).toEqual([]);
    expect(pendingOf({ pending: 'soon' })).toEqual([]);
  });
});

describe('what the GM reads', () => {
  it('names the player and the world, and warns that saying yes disconnects the table', () => {
    const prompt = swapPrompt(waiting('r1'));

    expect(prompt).toContain('Riley');
    expect(prompt).toContain('the-grand-explorers');
    expect(prompt).toContain('disconnected');
  });

  it('shows what the player said, and says "another world" when COO named none', () => {
    const said = swapPrompt(waiting('r1', { message: 'Session starts at 7' }));
    const nameless = swapPrompt(waiting('r1', { to: '' }));

    expect(said).toContain('Session starts at 7');
    expect(nameless).toContain('another world');
  });

  /* ⛔ The requester's name is a Foundry user name COO derives from a COO username: never raw HTML. */
  it('escapes a name that would otherwise inject markup into the dialog', () => {
    const prompt = swapPrompt(waiting('r1', { requester: '<img src=x onerror=1>' }));

    expect(prompt).not.toContain('<img');
    expect(prompt).toContain('&lt;img');
  });
});
