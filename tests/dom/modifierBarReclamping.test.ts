import { describe, expect, it } from 'vitest';

import {
  KeyboardSynthesizer,
  type KeyboardManagerLike,
} from '../../src/modifiers/KeyboardSynthesizer.js';
import { ModifierBar } from '../../src/modifiers/ModifierBar.js';

describe('ModifierBar reclamping and attachment', () => {
  /**
   * `reclamp` is what keeps the bar off the sidebar after Foundry re-renders, and `onViewportChanged`
   * is what keeps it on screen after a rotation. Neither had been executed once, and a rotation that
   * strands the bar off screen is ADR 0009's bug returning by another route.
   */
  it('re-clamps when attached, and does nothing when it is not', () => {
    const manager: KeyboardManagerLike = { downKeys: new Set<string>() };
    let available = 1000;
    const bar = new ModifierBar({
      document,
      synthesizer: new KeyboardSynthesizer({ document, getKeyboardManager: () => manager }),
      onFlagsChanged: () => undefined,
      initialPosition: { x: 400, y: 50 },
      getAvailableWidth: () => available,
    });

    // Not attached: reclamp must be a no op rather than throwing on an element with no layout.
    expect(() => {
      bar.reclamp();
    }).not.toThrow();
    expect(bar.isAttached()).toBe(false);
    expect(bar.getPosition()).toEqual({ x: 400, y: 50 });

    bar.attach();
    expect(bar.isAttached()).toBe(true);

    // jsdom reports offsetWidth as 0, so the clamp cannot bind on width here. What is being proved
    // is that the attached branch RUNS and the unattached one does not, which is the difference
    // between a bar that reflows after a rotation and one that stays where it was.
    available = 200;
    expect(() => {
      bar.reclamp();
    }).not.toThrow();

    expect(() => {
      window.dispatchEvent(new Event('resize'));
    }).not.toThrow();

    bar.detach();
    expect(bar.isAttached()).toBe(false);
  });
});
describe('ModifierBar guards against a missing button', () => {
  /** The collapse button, and a detach that has nothing to detach. */
  it('collapses from its own button, and tolerates a double detach', () => {
    const manager: KeyboardManagerLike = { downKeys: new Set<string>() };
    const bar = new ModifierBar({
      document,
      synthesizer: new KeyboardSynthesizer({ document, getKeyboardManager: () => manager }),
      onFlagsChanged: () => undefined,
      /*
       * ⚠️ Stated rather than assumed. This test is about the button TOGGLING, and it used to open
       * by asserting the default was expanded, so changing that default broke a test that has no
       * opinion about it. The default is pinned on its own below, where it can change deliberately.
       */
      initialCollapsed: false,
    });
    bar.attach();

    const collapse = bar
      .getElement()
      .querySelector<HTMLButtonElement>('.tb-modifier-bar__collapse');
    expect(bar.isCollapsed()).toBe(false);

    collapse?.click();
    expect(bar.isCollapsed()).toBe(true);

    collapse?.click();
    expect(bar.isCollapsed()).toBe(false);

    // Detaching twice must be a no op, not a second clearAll against a removed element.
    bar.detach();
    expect(() => {
      bar.detach();
    }).not.toThrow();
    expect(bar.isAttached()).toBe(false);
  });

  // The "unknown modifier code" guard is covered by modifierBarKeyListDrift.test.ts, which stages
  // the real drift between MODIFIER_CODES and MODIFIER_KEYS rather than inventing a fake code that
  // `diff` would never report in the first place.
});

/**
 * ⚠️ The default is a PRODUCT decision, so it gets its own test rather than riding along inside one
 * about toggling. Changed to collapsed 2026-08-13 at the user's request: expanded, the bar is the
 * full key grid plus the tray, covering roughly a quarter of a 360x607 phone viewport on top of the
 * map. Collapsing is partial, so the tray keeps the hand, drop, pause and diagnose buttons.
 */
describe('how the bar opens when nobody has said', () => {
  const barWith = (overrides: { initialCollapsed?: boolean } = {}) => {
    const manager: KeyboardManagerLike = { downKeys: new Set<string>() };
    return new ModifierBar({
      document,
      synthesizer: new KeyboardSynthesizer({ document, getKeyboardManager: () => manager }),
      onFlagsChanged: () => undefined,
      ...overrides,
    });
  };

  it('starts partially collapsed, so it does not cover the map', () => {
    expect(barWith().isCollapsed()).toBe(true);
  });

  /** A saved preference still wins, or the default would be an override rather than a default. */
  it('yields to an explicit choice in either direction', () => {
    expect(barWith({ initialCollapsed: false }).isCollapsed()).toBe(false);
    expect(barWith({ initialCollapsed: true }).isCollapsed()).toBe(true);
  });
});
