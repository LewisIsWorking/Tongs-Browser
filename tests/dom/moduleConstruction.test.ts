import { beforeEach, describe, expect, it } from 'vitest';

import { buildModule as build, stubFoundryEnvironment } from './support/moduleUnderTest.js';

/**
 * The module is CONSTRUCTED and ENABLED, exactly as `main.ts` does it on Foundry's ready hook.
 *
 * ⚠️ This suite exists because its absence shipped a broken build. Every other test here exercises a
 * part in isolation, and every one of them stayed green while the composition root threw on
 * construction: the scene control still appeared, because it is registered on `init`, and no bar and
 * no cursor ever did, because `new TongsBrowser(...)` never returned.
 *
 * A composition root is exactly the thing unit tests cannot cover, and it is the thing most likely to
 * break during a refactor, because it is where the ORDER of construction lives. Nothing below asserts
 * behaviour that a focused suite does not already own. What it asserts is that the pieces can be put
 * together at all.
 */
beforeEach(() => {
  stubFoundryEnvironment();
});

describe('constructing the module', () => {
  it('builds every part without throwing', () => {
    expect(() => build()).not.toThrow();
  });

  /**
   * ⚠️ The failure that shipped. Every part a tray button drives is built by the same factory that
   * builds the tray, and one taken EAGERLY there is read before the field holding it is assigned.
   * The symptom is not a build error and not a failing test: it is a tray button that throws on the
   * first tap, or a constructor that throws and takes the whole module with it.
   */
  it('gives every tray button something to drive', () => {
    const bar = build().getModifierBar();
    bar.attach();

    const buttons = [...bar.getElement().querySelectorAll<HTMLButtonElement>('[data-action]')];
    expect(buttons.length).toBeGreaterThan(0);

    for (const button of buttons) {
      expect(
        () => {
          button.click();
        },
        `tapping '${String(button.dataset['action'])}' threw`
      ).not.toThrow();
    }
  });

  it('exposes the pointer, cursor, bar and scaler it was asked for', () => {
    const module = build();

    expect(module.getPointer()).toBeDefined();
    expect(module.getCursor()).toBeDefined();
    expect(module.getModifierBar()).toBeDefined();
    expect(module.getScaler()).toBeDefined();
  });
});

describe('enabling the module', () => {
  /** What the user sees: a cursor and a bar, both in the document. */
  it('attaches the cursor and the bar', () => {
    const module = build();

    module.enable();

    expect(module.isEnabled()).toBe(true);
    expect(module.getCursor().getElement().isConnected).toBe(true);
    expect(module.getModifierBar().isAttached()).toBe(true);
  });

  it('leaves the bar alone when the caller asked for it to be off', () => {
    const module = build({ modifierBarEnabled: false });

    module.enable();

    expect(module.isEnabled()).toBe(true);
    expect(module.getModifierBar().isAttached()).toBe(false);
  });

  it('takes it all back down again', () => {
    const module = build();
    module.enable();

    module.disable();

    expect(module.isEnabled()).toBe(false);
    expect(module.getCursor().getElement().isConnected).toBe(false);
    expect(module.getModifierBar().isAttached()).toBe(false);
  });

  it('is idempotent, so a second enable does not build a second bar', () => {
    const module = build();

    module.enable();
    module.enable();

    expect(document.querySelectorAll('.tb-modifier-bar')).toHaveLength(1);
  });

  /** Refreshing the tray reads live state, and must not care that Foundry is absent under test. */
  it('refreshes the tray without a Foundry to read', () => {
    const module = build();
    module.enable();

    expect(() => {
      module.refreshTray();
    }).not.toThrow();
  });
});
