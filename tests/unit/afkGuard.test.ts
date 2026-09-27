import { describe, expect, it, vi } from 'vitest';

import { AfkGuard, WARN_BEFORE_MS } from '../../src/swaps/AfkGuard.js';
import { registerAfkGuard, startAfkGuard } from '../../src/swaps/startAfkGuard.js';

/**
 * Signing out an idle GM. Written 2026-09-26 (Lewis: "a 2 hour afk GM auto kick timer").
 * A fake clock drives it; nothing waits in real time.
 */
const MIN = 60_000;

const guardAt = (answer: () => Promise<boolean>, limit = 120) => {
  let t = 0;
  const signOut = vi.fn();
  const warn = vi.fn(answer);
  const guard = new AfkGuard({ now: () => t, warn, signOut }, limit);
  return { guard, signOut, warn, at: (ms: number) => (t = ms) };
};

describe('the idle GM guard', () => {
  it('stays quiet while the GM is active, warns once near the limit, and signs out at it', async () => {
    const { guard, signOut, warn, at } = guardAt(() => new Promise(() => undefined)); // prompt left open
    at(100 * MIN);
    expect(await guard.tick()).toBe('active');

    at(120 * MIN - WARN_BEFORE_MS);
    void guard.tick();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(await guard.tick()).toBe('warned');
    expect(warn).toHaveBeenCalledTimes(1);

    at(120 * MIN);
    expect(await guard.tick()).toBe('signed-out');
    expect(await guard.tick()).toBe('signed-out');
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('"I\'m here" resets the clock', async () => {
    const { guard, signOut, at } = guardAt(() => Promise.resolve(true));
    at(116 * MIN);
    expect(await guard.tick()).toBe('active');
    expect(guard.idleSeconds()).toBe(0);
    at(200 * MIN);
    expect(await guard.tick()).not.toBe('signed-out');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('"Sign me out now" signs out straight away; a prompt that cannot show leaves it to the limit', async () => {
    const leaving = guardAt(() => Promise.resolve(false));
    leaving.at(116 * MIN);
    expect(await leaving.guard.tick()).toBe('signed-out');
    expect(leaving.signOut).toHaveBeenCalledTimes(1);

    const broken = guardAt(() => Promise.reject(new Error('no dialog')));
    broken.at(116 * MIN);
    expect(await broken.guard.tick()).toBe('warned');
    expect(broken.signOut).not.toHaveBeenCalled();
    broken.at(121 * MIN);
    expect(await broken.guard.tick()).toBe('signed-out');
  });

  it('0 minutes turns it off, and activity resets it', async () => {
    const off = guardAt(() => Promise.resolve(true), 0);
    off.at(10_000 * MIN);
    expect(await off.guard.tick()).toBe('off');

    const busy = guardAt(() => Promise.resolve(true));
    busy.at(90 * MIN);
    busy.guard.touch();
    busy.at(150 * MIN);
    expect(await busy.guard.tick()).toBe('active');
  });
});

describe('wiring it into Foundry', () => {
  const settings = (minutes: unknown) => ({ register: vi.fn(), get: vi.fn(() => minutes) });

  it('registers a GM setting defaulting to two hours', () => {
    const s = settings(120);
    registerAfkGuard(s);
    expect(s.register.mock.calls[0]?.[2]).toMatchObject({
      scope: 'world',
      type: Number,
      default: 120,
    });
  });

  it('runs only for a GM, watches activity, and signs out through Foundry', async () => {
    const env = { target: { addEventListener: vi.fn() }, now: () => 0, every: vi.fn() };
    expect(startAfkGuard(settings(120), { game: { user: { isGM: false } } }, env)).toBeUndefined();
    expect(env.target.addEventListener).not.toHaveBeenCalled();

    let now = 0;
    const logOut = vi.fn();
    const ticks: (() => void)[] = [];
    const gmEnv = {
      target: { addEventListener: vi.fn() },
      now: () => now,
      every: (run: () => void) => ticks.push(run),
    };
    const idle = startAfkGuard(settings(1), { game: { user: { isGM: true }, logOut } }, gmEnv);
    expect(idle).toBeTypeOf('function');
    expect(gmEnv.target.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), {
      passive: true,
    });

    now = 2 * MIN; // past a one-minute limit
    ticks[0]?.();
    await Promise.resolve();
    expect(logOut).toHaveBeenCalledTimes(1);
  });

  it('falls back to the join page when Foundry has no logOut', async () => {
    let now = 0;
    const assign = vi.fn();
    const ticks: (() => void)[] = [];
    startAfkGuard(
      settings(1),
      { game: { user: { isGM: true } }, location: { assign } },
      {
        target: { addEventListener: vi.fn() },
        now: () => now,
        every: (run: () => void) => ticks.push(run),
      }
    );
    now = 2 * MIN;
    ticks[0]?.();
    await Promise.resolve();
    expect(assign).toHaveBeenCalledWith('/join');
  });
});
