import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The loading screen's title names the world (2026-11-14). Tongs is imported while `game` is Foundry's stand-in
 * (client.mjs: `game: {view}`), which Foundry REPLACES with the real Game, so the world must be read from the
 * global when each hook fires, never from what was there at import.
 */
describe('the loading screen title', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
    document.body.replaceChildren();
  });

  it("names the world even though Foundry replaces its stand-in game after Tongs' import", async () => {
    const handlers = new Map<string, () => void>();
    vi.stubGlobal('Hooks', { once: (hook: string, fn: () => void) => handlers.set(hook, fn) });
    vi.stubGlobal('game', { view: 'game' }); // Foundry's stand-in until the world is fetched
    await import('../../src/ui/showLoadingOverlayOnImport.js');
    vi.stubGlobal('game', { world: { id: 'w', title: 'The Real World' } });
    handlers.get('init')?.();
    expect(document.querySelector('.tongs-loading-title')?.textContent).toBe(
      'Opening The Real World'
    );
  });
});
