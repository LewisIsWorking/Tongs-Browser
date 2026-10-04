import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoadingOverlay } from '../../src/ui/LoadingOverlay.js';
import { LOADING_STAGES, startLoadingOverlay } from '../../src/ui/startLoadingOverlay.js';

/**
 * The loading screen's edges (2026-10-04): a page still parsing, a screen hidden before it ever attached, calls
 * after it is gone, no page at all, a world with no title, and the side-effect import main.ts starts it with.
 */
const noBody = (): Document => {
  const doc = document.implementation.createHTMLDocument('foundry');
  doc.body.remove();
  return doc;
};

describe('the loading screen, at its edges', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('waits for the page body when Tongs loads before it exists', () => {
    const doc = noBody();
    new LoadingOverlay(doc).show('t', 's');
    expect(doc.getElementById('tongs-loading-overlay')).toBeNull();

    doc.dispatchEvent(new Event('DOMContentLoaded'));
    expect(doc.getElementById('tongs-loading-overlay')).not.toBeNull();
  });

  it('never attaches a screen that was hidden before the body arrived', () => {
    const doc = noBody();
    const screen = new LoadingOverlay(doc);
    screen.show('t', 's');
    screen.hide();
    doc.dispatchEvent(new Event('DOMContentLoaded'));
    expect(doc.getElementById('tongs-loading-overlay')).toBeNull();
    expect(screen.isShowing).toBe(false);
  });

  it('ignores updates and a second hide once it is gone', () => {
    vi.useFakeTimers();
    const screen = new LoadingOverlay(document);
    screen.hide();
    screen.show('t', 's');
    screen.hide();
    screen.hide();
    screen.setStage('late');
    screen.setTitle('late');
    vi.runAllTimers();
    expect(document.getElementById('tongs-loading-overlay')).toBeNull();
  });

  it('does nothing without a page', () => {
    expect(startLoadingOverlay({ Hooks: { once: () => undefined } })).toBeNull();
  });

  it('keeps its own title when the world has none', () => {
    const handlers = new Map<string, () => void>();
    startLoadingOverlay({
      Hooks: { once: (h: string, fn: () => void) => handlers.set(h, fn) },
      game: {},
      document,
    });
    handlers.get('init')?.();
    expect(document.querySelector('.tongs-loading-title')?.textContent).toBe('Opening Foundry');
    expect(document.querySelector('.tongs-loading-stage')?.textContent).toBe(LOADING_STAGES.init);
  });

  it('goes up from the side-effect import main.ts starts with', async () => {
    vi.stubGlobal('Hooks', { once: () => undefined });
    vi.stubGlobal('game', undefined);
    await import('../../src/ui/showLoadingOverlayOnImport.js');
    expect(document.getElementById('tongs-loading-overlay')).not.toBeNull();
  });
});
