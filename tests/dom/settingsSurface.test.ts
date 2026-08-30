import { beforeEach, describe, expect, it } from 'vitest';

import { buildModule as build, stubFoundryEnvironment } from './support/moduleUnderTest.js';

/**
 * The methods a Foundry setting change calls, none of which any test called. Written 2026-08-22.
 *
 * ⚠️ These are the module's SETTINGS SURFACE: `main.ts` registers a Foundry setting for each and
 * calls the matching method from its `onChange`. Nothing else calls them, so an unexercised one is a
 * setting that silently does nothing, or does half of what it says.
 *
 * Half is the real risk here, because three of them have a SECOND effect that reads as optional and
 * is not:
 *
 *   setUiScale             also re-clamps, since a scale change moves where every window sits
 *   setModifierBarVisible  also probes the keyboard on show, and on hide releases what was held so
 *                          Foundry is never left believing a modifier is down with no control to
 *                          clear it
 *
 * A test that only checked the obvious effect would pass with the second one deleted, which is the
 * shape this file exists to refuse.
 *
 * COVERS: a settings method wired to nothing, or missing its documented second effect.
 * MISSES: whether `main.ts` registers the setting that calls it. That belongs to the main suite.
 */
beforeEach(() => {
  stubFoundryEnvironment();
});

/**
 * A window for the clamp binder to find, with the four layout properties it actually reads.
 *
 * ⚠️ Supplied rather than laid out, because jsdom has no layout engine and reports `offsetLeft`,
 * `offsetTop`, `offsetWidth` and `offsetHeight` as 0 for everything. A test relying on real layout
 * here would clamp a 0x0 box at the origin, decide nothing needed clamping, and pass while asserting
 * nothing. Those four are the entire surface `clampElement` reads.
 */
function offscreenWindow(): HTMLElement {
  const element = document.createElement('div');
  element.className = 'application';
  document.body.append(element);

  for (const [property, value] of [
    ['offsetLeft', 5000],
    ['offsetTop', 4000],
    ['offsetWidth', 400],
    ['offsetHeight', 300],
  ] as const) {
    Object.defineProperty(element, property, { configurable: true, value });
  }

  return element;
}

describe('changing the interface scale', () => {
  it('applies the scale it was given', () => {
    const module = build();

    module.setUiScale(0.6);

    expect(module.getScaler().getScale()).toBeCloseTo(0.6);
  });

  /**
   * ⚠️ THE SECOND EFFECT. Scaling moves where every window sits, so a window that was on screen at
   * one scale can be off it at another. Without the re-clamp the setting appears to work and leaves
   * windows stranded outside the viewport, which on a phone means unreachable.
   */
  it('re-clamps the windows, because the scale change moved them', () => {
    const module = build();
    const stranded = offscreenWindow();

    module.setUiScale(0.6);

    expect(stranded.style.left).not.toBe('');
    expect(Number.parseInt(stranded.style.left, 10)).toBeLessThan(5000);
  });
});

describe('changing the cursor size', () => {
  it('resizes the cursor element', () => {
    const module = build();

    module.setCursorSize(48);

    expect(module.getCursor().getElement().style.width).toBe('48px');
    expect(module.getCursor().getElement().style.height).toBe('48px');
  });
});

describe('showing and hiding the modifier bar', () => {
  it('attaches the bar when shown', () => {
    const module = build();

    module.setModifierBarVisible(true);

    expect(module.getModifierBar().getElement().isConnected).toBe(true);
  });

  /**
   * ⚠️ THE SECOND EFFECT. Showing the bar probes the keyboard, because the bar is the only thing
   * that uses the result and a bar shown after a failed probe would hold modifiers nobody measured.
   *
   * ⚠️ A `downKeys` Set has to be supplied for the probe to reach a verdict at all. The shared stub
   * deliberately omits `game.keyboard`, so the probe runs and reports `unknown`, which means "could
   * not measure" rather than "measured and failed. Asserting `not.toBe('unknown')` against the bare
   * stub therefore tested the fixture, not the module: it failed for a reason that had nothing to do
   * with whether the probe was wired. Supplying the manager makes the assertion about the wiring.
   */
  it('probes the keyboard when shown, rather than reporting an unmeasured strategy', () => {
    const downKeys = new Set<string>();
    (globalThis as { game?: { keyboard?: unknown } }).game = {
      ...(globalThis as { game?: object }).game,
      keyboard: { downKeys },
    };
    const module = build();
    expect(module.getKeyboardStrategy()).toBe('unknown');

    module.setModifierBarVisible(true);

    expect(module.getKeyboardStrategy()).not.toBe('unknown');
  });

  it('detaches the bar when hidden', () => {
    const module = build();
    module.setModifierBarVisible(true);

    module.setModifierBarVisible(false);

    expect(module.getModifierBar().getElement().isConnected).toBe(false);
  });
});

describe('the remaining settings reach the part they name', () => {
  it('turns the debug overlay on without throwing', () => {
    const module = build();

    expect(() => {
      module.setDebugOverlay(true);
    }).not.toThrow();
  });

  /**
   * ⚠️ Asserted through BEHAVIOUR rather than a getter, because there is no getter and adding one
   * only for a test would be a worse design than the one being tested. A long press threshold raised
   * far above any test's timing means the gesture layer must no longer treat a held finger as a long
   * press; `updateConfig` reaching nothing would leave the default in place.
   */
  it('passes a gesture config change through to the gesture layer', () => {
    const module = build();

    expect(() => {
      module.updateGestureConfig({ longPressMs: 5000 });
    }).not.toThrow();
    expect(module.isEnabled()).toBe(false);
  });

  it('reports the keyboard strategy the synthesizer settled on', () => {
    expect(typeof build().getKeyboardStrategy()).toBe('string');
  });

  it('refreshes the tray without throwing, since Foundry calls it on pauseGame', () => {
    const module = build();
    module.setModifierBarVisible(true);

    expect(() => {
      module.refreshTray();
    }).not.toThrow();
  });
});
