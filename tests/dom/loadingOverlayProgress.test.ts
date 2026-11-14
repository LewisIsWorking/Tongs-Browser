import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOADING_HISTORY_KEY } from '../../src/ui/loadingHistory.js';
import { LOADING_TICK_MS, startLoadingOverlay } from '../../src/ui/startLoadingOverlay.js';

/**
 * The loading screen's percentage and time left (2026-11-14), "Preparing characters and items: 42%, about 1 min
 * left" like the COO portal's world launch. Driven through fake hooks in Foundry's order, with fake time.
 */
const overlay = (): HTMLElement | null => document.getElementById('tongs-loading-overlay');
const line = (): string | null | undefined =>
  overlay()?.querySelector('.tongs-loading-stage')?.textContent;
const fill = (): HTMLElement | null | undefined =>
  overlay()?.querySelector<HTMLElement>('.tongs-loading-bar > div');

interface FakeGame {
  ready?: boolean;
  world?: { id?: string; title?: string };
}

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

/** One load of world `id` through every hook, waiting `seconds[i]` in each stage. */
function load(id: string, seconds: readonly number[]): ReturnType<typeof fakeHooks> {
  const hooks = fakeHooks();
  const game: FakeGame = {};
  startLoadingOverlay({ Hooks: hooks.Hooks, game, document });
  game.world = { id, title: id };
  ['init', 'setup', 'canvasInit', 'canvasDraw', 'ready'].forEach((hook, i) => {
    vi.advanceTimersByTime((seconds[i] ?? 0) * 1000);
    hooks.fire(hook);
  });
  vi.advanceTimersByTime(500);
  return hooks;
}

/** Starts a load of world `id` and stops after `init`. */
function opening(id: string): ReturnType<typeof fakeHooks> {
  const hooks = fakeHooks();
  startLoadingOverlay({ Hooks: hooks.Hooks, game: { world: { id, title: id } }, document });
  return hooks;
}

describe('the loading screen percentage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.replaceChildren();
  });

  it('shows a percentage from the first moment, with no time left before there is any history', () => {
    const hooks = opening('w');
    expect(line()).toBe('Loading the world: 1%');
    hooks.fire('init');
    expect(line()).toMatch(/^Preparing characters and items: \d+%$/);
    expect(overlay()?.getAttribute('aria-valuenow')).toMatch(/^\d+$/);
  });

  it('fills the bar to the percentage and glides it on, rather than sliding to and fro', () => {
    const hooks = opening('w');
    hooks.fire('init');
    expect(fill()?.style.transform).toMatch(/^scaleX\(0\.\d+\)$/);
    expect(fill()?.style.transition).toMatch(/^transform [1-9]\d*ms linear$/);
    expect(overlay()?.querySelector('style')?.textContent).not.toContain('infinite');
  });

  it('gives the time left on the next load of a world it has timed, counting down', () => {
    load('w', [10, 20, 5, 10, 5]); // 50 s in all
    expect(localStorage.getItem(LOADING_HISTORY_KEY)).toContain('"w"');

    const hooks = opening('w');
    expect(line()).toBe('Loading the world: 1%, about 50 seconds left');
    vi.advanceTimersByTime(10_000);
    hooks.fire('init');
    expect(line()).toBe('Preparing characters and items: 20%, about 40 seconds left');
    vi.advanceTimersByTime(10_000);
    expect(line()).toBe('Preparing characters and items: 40%, about 30 seconds left');
    vi.advanceTimersByTime(11_000);
    expect(line()).toMatch(/^Preparing characters and items: \d+%, taking longer than usual$/);
  });

  it('reads how many of the map pictures Foundry has loaded, and only while they load', () => {
    load('w', [10, 20, 5, 10, 5]);
    const notices = document.createElement('ol');
    notices.id = 'notifications';
    notices.innerHTML = '<li class="notification progress" style="--pct: 50%"></li>';
    document.body.append(notices);

    const hooks = opening('w');
    hooks.fire('init');
    expect(line()).toBe('Preparing characters and items: 20%, about 40 seconds left');
    hooks.fire('setup');
    hooks.fire('canvasInit');
    // The pictures start at 35/50 = 70% and are 20% wide: half loaded is 80%, with 5 s of them and 5 of drawing.
    expect(line()).toBe('Getting the map ready: 80%, about 10 seconds left');
    vi.advanceTimersByTime(LOADING_TICK_MS);
    expect(line()).toBe('Getting the map ready: 80%, about 10 seconds left');
  });

  it('never goes backwards when this world turns out quicker than the one opened last', () => {
    load('slow-start', [100, 1, 1, 1, 1]);
    const hooks = opening('quick');
    vi.advanceTimersByTime(90_000);
    const before = Number(overlay()?.getAttribute('aria-valuenow'));
    expect(before).toBeGreaterThan(50);
    hooks.fire('init'); // 'quick' has no history: its init starts at the defaults' 14%
    expect(Number(overlay()?.getAttribute('aria-valuenow'))).toBe(before);
    expect(line()).toBe(`Preparing characters and items: ${String(before)}%`);
  });

  it('fills to 100% at ready and goes', () => {
    const hooks = opening('w');
    hooks.fire('init');
    hooks.fire('ready');
    expect(overlay()?.getAttribute('aria-valuenow')).toBe('100');
    expect(fill()?.style.transform).toBe('scaleX(1)');
    expect(line()).toBe('Ready');
    vi.advanceTimersByTime(500);
    expect(overlay()).toBeNull();
  });

  it('still shows the percentage when the browser refuses storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    load('w', [1, 1, 1, 1, 1]);
    const hooks = opening('w');
    hooks.fire('init');
    expect(line()).toMatch(/^Preparing characters and items: \d+%$/);
  });

  it('still shows the percentage when even asking for storage throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    load('w', [1, 1, 1, 1, 1]);
    const hooks = opening('w');
    hooks.fire('init');
    expect(line()).toMatch(/^Preparing characters and items: \d+%$/);
  });

  it('still shows the percentage on a page with no window to keep history in', () => {
    const doc = document.implementation.createHTMLDocument('foundry');
    const hooks = fakeHooks();
    startLoadingOverlay({ Hooks: hooks.Hooks, game: { world: { id: 'w' } }, document: doc });
    hooks.fire('init');
    expect(doc.querySelector('.tongs-loading-stage')?.textContent).toMatch(
      /^Preparing characters and items: \d+%$/
    );
  });

  it('stays out of the way of a map drawn after the world is ready', () => {
    const hooks = opening('w');
    hooks.fire('ready');
    hooks.fire('canvasInit');
    expect(line()).toBe('Ready');
    expect(overlay()?.getAttribute('aria-valuenow')).toBe('100');
  });

  it('remembers nothing from a load that gave up waiting', () => {
    const hooks = opening('w');
    hooks.fire('init');
    vi.advanceTimersByTime(11 * 60_000);
    hooks.fire('ready');
    expect(localStorage.getItem(LOADING_HISTORY_KEY)).toBeNull();
  });
});
