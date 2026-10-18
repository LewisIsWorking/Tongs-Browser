import { describe, expect, it, vi } from 'vitest';

import { SIGN_OUT_NOTE, markLogOuts, noteSignOut } from '../../src/swaps/signOutNote.js';
import type { LogOutGame } from '../../src/swaps/signOutNote.js';
import { startAfkGuard } from '../../src/swaps/startAfkGuard.js';

/**
 * The COO portal auto-enters the running world unless it finds this note (2026-10-18). Lewis: "yes do it", on
 * "Can we make it auto-enter the running world?". A deliberate sign-out must leave it, or the player is put
 * straight back in.
 */
function memoryStore(): {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  data: Map<string, string>;
} {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

describe('the sign-out note', () => {
  it('Log Out leaves an "out" note, then logs out as before', () => {
    const store = memoryStore();
    const logOut = vi.fn(() => 'done');
    const game: LogOutGame = { logOut };
    markLogOuts(game, store);

    expect(game.logOut?.()).toBe('done');
    expect(logOut).toHaveBeenCalledTimes(1);
    expect(store.data.get(SIGN_OUT_NOTE)).toBe('out');
  });

  it('keeps an earlier note, so the AFK guard\'s "afk" survives the logOut it calls', () => {
    const store = memoryStore();
    noteSignOut(store, 'afk');
    noteSignOut(store, 'out');
    expect(store.data.get(SIGN_OUT_NOTE)).toBe('afk');
  });

  it('never stops a sign-out: blocked storage, no storage, or no logOut at all', () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error('blocked');
      },
      setItem: vi.fn(),
    };
    expect(() => {
      noteSignOut(blocked, 'out');
    }).not.toThrow();
    expect(() => {
      noteSignOut(undefined, 'out');
    }).not.toThrow();
    const game: LogOutGame = {};
    markLogOuts(game, memoryStore());
    expect(game.logOut).toBeUndefined();
    expect(() => {
      markLogOuts(undefined, memoryStore());
    }).not.toThrow();
  });

  it('the AFK guard notes "afk" before it signs an idle GM out', async () => {
    const store = memoryStore();
    let now = 0;
    const ticks: (() => void)[] = [];
    const logOut = vi.fn(() => {
      expect(store.data.get(SIGN_OUT_NOTE)).toBe('afk');
    });
    startAfkGuard(
      { register: vi.fn(), get: vi.fn(() => 1) },
      { game: { user: { isGM: true }, logOut }, sessionStorage: store },
      {
        target: { addEventListener: vi.fn() },
        now: () => now,
        every: (run) => {
          ticks.push(run);
        },
      }
    );
    now = 60_000;
    ticks[0]?.();
    await Promise.resolve();
    now = 6 * 60_000;
    ticks[0]?.();
    await Promise.resolve();
    expect(logOut).toHaveBeenCalledTimes(1);
  });
});
