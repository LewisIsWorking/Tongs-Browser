import { describe, expect, it, vi } from 'vitest';

import { EncounterSync } from '../../src/encounter/EncounterSync.js';
import type { EncounterSyncPorts } from '../../src/encounter/EncounterSync.js';
import type { EncounterSnapshot } from '../../src/encounter/encounterSnapshot.js';

/**
 * Posting an encounter as it changes, from the active full GM's browser. Written 2026-09-16.
 *
 * ⚠️ The timer is a fake the test runs by hand, so "coalesced" is asserted by what is pending, not by waiting.
 */
const snapshot = (round = 1): EncounterSnapshot => ({
  encounterId: 'c1',
  round,
  allies: [],
  enemies: [],
  ended: false,
});

const harness = (overrides: Partial<EncounterSyncPorts> = {}) => {
  const posts: { code: string; snapshot: EncounterSnapshot }[] = [];
  const timers = new Map<number, () => void>();
  let next = 0;
  let tracker: number | undefined;
  const ports: EncounterSyncPorts = {
    role: () => 'act',
    campaign: () => ({ kind: 'one', code: 'C09' }),
    read: (_combat, ended) => ({ ...snapshot(), ended }),
    trackerId: () => tracker,
    saveTrackerId: vi.fn((_combat, id: number) => {
      tracker = id;
      return Promise.resolve();
    }),
    post: vi.fn((code: string, sent: EncounterSnapshot) => {
      posts.push({ code, snapshot: sent });
      return Promise.resolve<number | null | 'signed-out'>(9001);
    }),
    later: (run) => {
      next += 1;
      timers.set(next, run);
      return next;
    },
    cancel: (handle) => {
      timers.delete(handle as number);
    },
    ...overrides,
  };
  const fire = async () => {
    const pending = [...timers.values()];
    timers.clear();
    pending.forEach((run) => {
      run();
    });
    await vi.waitFor(() => Promise.resolve());
  };
  return { sync: new EncounterSync(ports, 10), ports, posts, timers, fire };
};

describe('keeping the tracker in step', () => {
  it('coalesces a burst of changes into one post, then keeps the tracker id Foundry will send back', async () => {
    const { sync, ports, posts, timers, fire } = harness();

    void sync.changed({ id: 'c1' });
    void sync.changed({ id: 'c1' });
    void sync.changed({ id: 'c1' });
    expect(timers.size).toBe(1);
    await fire();

    expect(posts).toEqual([{ code: 'C09', snapshot: snapshot() }]);
    await vi.waitFor(() => {
      expect(ports.saveTrackerId).toHaveBeenCalledWith({ id: 'c1' }, 9001);
    });

    await sync.send({ id: 'c1' }, false);
    expect(posts[1]?.snapshot.trackerMessageId).toBe(9001);
    expect(ports.saveTrackerId).toHaveBeenCalledTimes(1);
  });

  it('sends an ended encounter at once, cancelling a waiting change, and saves no id for it', async () => {
    const { sync, ports, posts, timers } = harness();
    void sync.changed({ id: 'c1' });

    await sync.changed({ id: 'c1' }, true);

    expect(timers.size).toBe(0);
    expect(posts).toEqual([{ code: 'C09', snapshot: { ...snapshot(), ended: true } }]);
    expect(ports.saveTrackerId).not.toHaveBeenCalled();
  });

  it('posts nothing from a browser that is not the active GM, for an encounter with no id, one not started, or no single campaign', async () => {
    for (const overrides of [
      { role: () => 'queue' as const },
      { campaign: () => ({ kind: 'none' as const, characters: [] }) },
      { read: () => snapshot(0) },
      { read: () => null },
    ]) {
      const { sync, posts, fire } = harness(overrides);
      void sync.changed({ id: 'c1' });
      void sync.changed({});
      await fire();
      expect(posts).toEqual([]);
    }
  });

  it('keeps nothing when COO refused or the GM is signed out', async () => {
    for (const answer of [null, 'signed-out' as const]) {
      const { sync, ports } = harness({ post: () => Promise.resolve(answer) });
      await sync.send({ id: 'c1' }, false);
      expect(ports.saveTrackerId).not.toHaveBeenCalled();
    }
  });
});
