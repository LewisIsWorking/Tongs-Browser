import { describe, expect, it, vi } from 'vitest';

import { WorldSwapGm } from '../../src/swaps/WorldSwapGm.js';
import type { WorldSwapPorts } from '../../src/swaps/WorldSwapGm.js';

/**
 * A GM answering a swap request COO no longer holds. Written 2026-09-27.
 *
 * ⚠️ Lewis answered after a server restart and was told "It will ask again". It never did: COO keeps
 * requests in memory, so a restart drops them (404), and one unanswered for 2 minutes comes back Expired.
 */
const waiting = { id: 'r1', requester: 'Riley', from: 'w2', to: 'w1', state: 'AwaitingGm' };

const gmAnswering = (status: number, reply: object) => {
  const notices: string[] = [];
  const ask = vi.fn(() => Promise.resolve(true));
  const ports: WorldSwapPorts = {
    isGm: () => true,
    worldId: () => 'w2',
    call: (_method, path) =>
      Promise.resolve(
        path.endsWith('/decision')
          ? { status, json: () => Promise.resolve(reply) }
          : { status: 200, json: () => Promise.resolve({ pending: [waiting] }) }
      ),
    ask,
    notify: (message) => notices.push(message),
  };
  return { gm: new WorldSwapGm(ports), ask, notices };
};

describe('a late answer to a world swap', () => {
  it.each([
    ['gone after a server restart', 404, {}],
    ['expired before the GM clicked', 200, { state: 'Expired' }],
  ])('says a request %s is over, and does not ask again', async (_why, status, reply) => {
    const { gm, ask, notices } = gmAnswering(status, reply);

    await gm.beat();
    await gm.beat();

    expect(ask).toHaveBeenCalledTimes(1);
    expect(notices).toEqual([
      "Riley's request had already expired, so nothing changed. They can press Play again.",
    ]);
  });

  it('says nothing when the answer landed', async () => {
    const { gm, notices } = gmAnswering(200, { state: 'Switching' });
    await gm.beat();
    expect(notices).toEqual([]);
  });
});
