import { describe, expect, it, vi } from 'vitest';

import { startAfkGuard } from '../../src/swaps/startAfkGuard.js';

/**
 * The idle GM limit a world gets when nobody has set one. Written 2026-09-29, when Lewis cut it from 2 hours
 * to 30 minutes ("Reduce the afk time to 30 mins") after an unattended GM held World 2 for an evening.
 */
const MIN = 60_000;

describe('the default idle limit', () => {
  it('signs a GM out after half an hour when the world has nothing saved', async () => {
    let now = 0;
    const logOut = vi.fn();
    const ticks: (() => void)[] = [];
    startAfkGuard(
      { register: vi.fn(), get: vi.fn(() => undefined) },
      { game: { user: { isGM: true }, logOut } },
      { target: { addEventListener: vi.fn() }, now: () => now, every: (run) => ticks.push(run) }
    );

    now = 29 * MIN;
    ticks[0]?.();
    await Promise.resolve();
    expect(logOut).not.toHaveBeenCalled();

    now = 30 * MIN;
    ticks[0]?.();
    await Promise.resolve();
    expect(logOut).toHaveBeenCalledTimes(1);
  });
});
