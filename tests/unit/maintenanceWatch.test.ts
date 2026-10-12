import { describe, expect, it, vi } from 'vitest';

import {
  IDLE_POLL_MS,
  MaintenanceWatch,
  WARNING_POLL_MS,
} from '../../src/maintenance/startMaintenance.js';
import type { MaintenancePorts } from '../../src/maintenance/startMaintenance.js';

/** The watch inside a world: when it asks COO, what it shows, and when it leaves (2026-10-11). */
const T = Date.parse('2026-10-12T04:55:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

function rig(answers: unknown[], world = 'c06') {
  let now = T;
  const ports = {
    ask: vi.fn(async () => Promise.resolve(answers.length > 1 ? answers.shift() : answers[0])),
    worldId: () => world,
    now: () => now,
    show: vi.fn(),
    hide: vi.fn(),
    leave: vi.fn(),
  } satisfies MaintenancePorts;
  return { ports, watch: new MaintenanceWatch(ports), advance: (ms: number) => (now += ms) };
}

describe('MaintenanceWatch', () => {
  it('asks once a minute while nothing is happening, and shows nothing', async () => {
    const { ports, watch, advance } = rig([{ phase: 'idle', now: iso(T) }]);
    await watch.tick();
    advance(30_000);
    await watch.tick();
    expect(ports.ask).toHaveBeenCalledTimes(1);
    advance(IDLE_POLL_MS);
    await watch.tick();
    expect(ports.ask).toHaveBeenCalledTimes(2);
    expect(ports.show).not.toHaveBeenCalled();
    expect(ports.hide).toHaveBeenCalled();
  });

  it('counts down every second, asks every five seconds, then leaves when the update runs', async () => {
    const warning = { phase: 'warning', world: 'c06', now: iso(T), closesAt: iso(T + 300_000) };
    const { ports, watch, advance } = rig([
      warning,
      warning,
      { phase: 'running', world: 'c06', now: iso(T) },
    ]);
    await watch.tick();
    expect(ports.show).toHaveBeenLastCalledWith(expect.stringContaining('closes in 5:00'));
    advance(1_000);
    await watch.tick();
    expect(ports.show).toHaveBeenLastCalledWith(expect.stringContaining('closes in 4:59'));
    expect(ports.ask).toHaveBeenCalledTimes(1);
    advance(WARNING_POLL_MS);
    await watch.tick();
    expect(ports.ask).toHaveBeenCalledTimes(2);
    advance(WARNING_POLL_MS);
    await watch.tick();
    expect(ports.leave).toHaveBeenCalledWith('/coo-updating');
    advance(WARNING_POLL_MS);
    await watch.tick();
    expect(ports.leave).toHaveBeenCalledTimes(1);
  });

  it('a lost connection during the countdown is the world closing: it leaves at once', async () => {
    const { ports, watch } = rig([
      { phase: 'warning', world: 'c06', now: iso(T), closesAt: iso(T + 1_000) },
    ]);
    await watch.tick();
    watch.disconnected();
    expect(ports.leave).toHaveBeenCalledWith('/coo-updating');
  });

  it('a lost connection with no update coming is left to Foundry', async () => {
    const { ports, watch } = rig([{ phase: 'idle', now: iso(T) }]);
    await watch.tick();
    watch.disconnected();
    expect(ports.leave).not.toHaveBeenCalled();
  });

  it('COO not answering keeps what was last known and never throws', async () => {
    const { ports, watch, advance } = rig([
      { phase: 'warning', world: 'c06', now: iso(T), closesAt: iso(T + 60_000) },
    ]);
    await watch.tick();
    ports.ask.mockRejectedValueOnce(new Error('offline'));
    advance(WARNING_POLL_MS);
    await expect(watch.tick()).resolves.toBeUndefined();
    expect(ports.show).toHaveBeenLastCalledWith(expect.stringContaining('closes in 0:55'));
  });
});
