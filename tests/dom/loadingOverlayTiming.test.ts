import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectedHint } from '../../src/ui/LoadingOverlay.js';
import { expectedLoadMs, LOADING_TIME_MAX_MS, rememberLoadMs } from '../../src/ui/loadingTimes.js';
import { startLoadingOverlay } from '../../src/ui/startLoadingOverlay.js';

/**
 * The loading bar that fills over the last load's time (2026-11-08, Lewis: "Reloads don't have a loading bar").
 * Foundry freezes the page while a world opens, so the only progress anyone can show is how long it took last
 * time: remembered per world in localStorage, filled by a transform animation that keeps running while frozen.
 */
const overlay = (): HTMLElement | null => document.getElementById('tongs-loading-overlay');
const bar = (): HTMLElement | null | undefined =>
  overlay()?.querySelector<HTMLElement>('.tongs-loading-bar > div');
const hint = (): string | null | undefined =>
  overlay()?.querySelector('.tongs-loading-hint')?.textContent;

function fakeHooks(): {
  Hooks: { once(hook: string, fn: () => void): void };
  fire(hook: string): void;
} {
  const handlers = new Map<string, (() => void)[]>();
  return {
    Hooks: { once: (hook, fn) => handlers.set(hook, [...(handlers.get(hook) ?? []), fn]) },
    fire: (hook) =>
      handlers.get(hook)?.forEach((fn) => {
        fn();
      }),
  };
}

describe('the loading bar that fills over the last load', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    document.body.replaceChildren();
    localStorage.clear();
  });

  it('slides, as before, the first time a browser opens a world', () => {
    startLoadingOverlay({ Hooks: fakeHooks().Hooks, document, storage: localStorage });
    expect(bar()?.classList.contains('tongs-loading-fill')).toBe(false);
    expect(hint()).toContain('Hang tight');
  });

  it('remembers how long the world took, then fills over that long on the next reload', () => {
    let clock = 0;
    const hooks = fakeHooks();
    const game: { world?: { id?: string; title?: string } } = {};
    startLoadingOverlay({
      Hooks: hooks.Hooks,
      game,
      document,
      storage: localStorage,
      now: () => clock,
    });
    game.world = { id: 'doomsday-funtime', title: 'Doomsday Funtime' };
    clock = 42_000;
    hooks.fire('ready');
    vi.advanceTimersByTime(500);
    expect(expectedLoadMs(localStorage, 'doomsday-funtime')).toBe(42_000);

    startLoadingOverlay({ Hooks: fakeHooks().Hooks, document, storage: localStorage });
    expect(bar()?.classList.contains('tongs-loading-fill')).toBe(true);
    expect(bar()?.style.getPropertyValue('--tongs-expected')).toBe('42000ms');
    expect(hint()).toBe('Last time this took about 42 seconds.');
  });

  it('fills with a transform animation, which keeps moving while Foundry blocks the page', () => {
    rememberLoadMs(localStorage, 30_000);
    startLoadingOverlay({ Hooks: fakeHooks().Hooks, document, storage: localStorage });
    expect(overlay()?.querySelector('style')?.textContent).toMatch(
      /@keyframes tongs-loading-fill[^}]*transform/
    );
  });

  it('shows the bar full as the world appears', () => {
    rememberLoadMs(localStorage, 30_000);
    const hooks = fakeHooks();
    startLoadingOverlay({ Hooks: hooks.Hooks, document, storage: localStorage });
    const fill = bar();
    hooks.fire('ready');
    expect(fill?.classList.contains('tongs-loading-done')).toBe(true);
  });

  it('ignores times that cannot be a real load: an instant cached reload, or a tab left stalled', () => {
    rememberLoadMs(localStorage, 300);
    rememberLoadMs(localStorage, LOADING_TIME_MAX_MS + 1);
    expect(expectedLoadMs(localStorage)).toBeUndefined();
  });

  it('prefers this world over the most recent load of another', () => {
    rememberLoadMs(localStorage, 20_000, 'small-world');
    rememberLoadMs(localStorage, 90_000, 'big-world');
    expect(expectedLoadMs(localStorage, 'small-world')).toBe(20_000);
    expect(expectedLoadMs(localStorage)).toBe(90_000);
  });

  it('survives a browser that refuses storage, falling back to the sliding bar', () => {
    const refusing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(() => {
      rememberLoadMs(refusing, 30_000);
    }).not.toThrow();
    expect(expectedLoadMs(refusing)).toBeUndefined();
  });

  it('says minutes for a long load', () => {
    expect(expectedHint(150_000)).toBe('Last time this took about 3 minutes.');
    expect(expectedHint(45_000)).toBe('Last time this took about 45 seconds.');
  });
});
