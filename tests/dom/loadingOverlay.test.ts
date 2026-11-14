import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoadingOverlay } from '../../src/ui/LoadingOverlay.js';
import {
  LOADING_GIVE_UP_MS,
  LOADING_STAGES,
  startLoadingOverlay,
} from '../../src/ui/startLoadingOverlay.js';

/**
 * The loading screen over Foundry's black start-up (2026-10-04, Lewis: the black screen "doesn't have a loading
 * bar"). Driven through fake hooks the way Foundry calls them: init, setup, ready.
 */
const overlay = (): HTMLElement | null => document.getElementById('tongs-loading-overlay');
/** The stage's name, without the percentage after it (loadingOverlayProgress.test.ts covers that). */
const stage = (): string | null | undefined =>
  overlay()?.querySelector('.tongs-loading-stage')?.textContent.split(':')[0];
const title = (): string | null | undefined =>
  overlay()?.querySelector('.tongs-loading-title')?.textContent;

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

describe('the loading screen', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('covers the page from the start, then follows the stages, then leaves at ready', () => {
    const hooks = fakeHooks();
    const game: { ready?: boolean; world?: { title?: string } } = {};
    startLoadingOverlay({ Hooks: hooks.Hooks, game, document });

    expect(overlay()?.getAttribute('role')).toBe('progressbar');
    expect(stage()).toBe(LOADING_STAGES.start);

    game.world = { title: 'Doomsday Funtime' };
    hooks.fire('init');
    expect(title()).toBe('Opening Doomsday Funtime');
    expect(stage()).toBe(LOADING_STAGES.init);

    hooks.fire('setup');
    expect(stage()).toBe(LOADING_STAGES.setup);

    hooks.fire('ready');
    vi.advanceTimersByTime(500);
    expect(overlay()).toBeNull();
  });

  it('does nothing when the world is already ready (a hot reload)', () => {
    expect(
      startLoadingOverlay({ Hooks: fakeHooks().Hooks, game: { ready: true }, document })
    ).toBeNull();
    expect(overlay()).toBeNull();
  });

  it('never stays up forever if Foundry fails before ready', () => {
    startLoadingOverlay({ Hooks: fakeHooks().Hooks, document });
    vi.advanceTimersByTime(LOADING_GIVE_UP_MS + 500);
    expect(overlay()).toBeNull();
  });

  it('is added once, however often it is asked', () => {
    const screen = new LoadingOverlay(document);
    screen.show('a', 'b');
    screen.show('c', 'd');
    new LoadingOverlay(document).show('e', 'f');
    expect(document.querySelectorAll('#tongs-loading-overlay')).toHaveLength(1);
    expect(screen.isShowing).toBe(true);
  });

  it('never blocks a click on the page underneath', () => {
    new LoadingOverlay(document).show('a', 'b');
    expect(overlay()?.querySelector('style')?.textContent).toContain('pointer-events: none');
  });

  it('moves the bar only by transform, which keeps moving while Foundry blocks the page', () => {
    const screen = new LoadingOverlay(document);
    screen.show('a', 'b');
    screen.setProgress(10, 10.5, { fill: 30, ms: 5000 });
    const bar = overlay()?.querySelector<HTMLElement>('.tongs-loading-bar > div');
    expect(bar?.style.transform).toBe('scaleX(0.3)');
    expect(bar?.style.transition).toBe('transform 5000ms linear');
    expect(overlay()?.querySelector('style')?.textContent).toMatch(/transform-origin: left/);
  });
});
