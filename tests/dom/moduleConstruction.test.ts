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

/**
 * Switching off has ordering rules, and each one exists because of what Foundry is left holding.
 *
 * ⚠️ Disabling is not "stop listening". Foundry keeps whatever state the module put it in, so an
 * in-progress drag, a latched modifier and a scaled interface all outlive the module unless teardown
 * deals with them. Every one of those is invisible afterwards: the module is off, so there is nothing
 * left to blame.
 */
describe('what disabling has to clean up', () => {
  /**
   * ⚠️ The gesture machine is reset BEFORE the binder is unbound, so a drag in progress is abandoned
   * rather than left hanging with Foundry still believing a button is held. Unbinding first would
   * remove the listeners that could ever end it.
   */
  it('abandons a drag in progress rather than leaving Foundry holding one', () => {
    const module = build();
    module.enable();
    const pointer = module.getPointer();
    pointer.beginDrag();
    expect(pointer.isDragging()).toBe(true);

    module.disable();

    expect(pointer.isDragging()).toBe(false);
  });

  /**
   * ⚠️ The scale custom property is REMOVED rather than set back to 1, so Foundry's own stylesheet
   * default takes over and nothing of ours is left behind. Setting 1 looks identical on screen and
   * leaves the interface permanently overridden by a value that merely happens to match.
   */
  it('gives the interface back rather than overriding it with a value that looks the same', () => {
    /*
     * ⚠️ 0.6, not something above 1. The scaler only ever SHRINKS: MAX_UI_SCALE is 1, because its job
     * is fitting Foundry onto a phone rather than enlarging it. A first draft of this test asked for
     * 1.4 and got 1 back, which is the clamp working correctly rather than a bug.
     */
    const module = build({ uiScale: 0.6 });
    module.enable();
    expect(document.documentElement.style.getPropertyValue('--tb-ui-scale')).toBe('0.6');

    module.disable();

    expect(document.documentElement.style.getPropertyValue('--tb-ui-scale')).toBe('');
    expect(document.documentElement.classList.contains('tb-scaled')).toBe(false);
  });

  /**
   * Enabling is idempotent and so is this: toggling is how the scene control works.
   *
   * ⚠️ Deleting `disable`'s early return does NOT fail this, and that is worth recording so nobody
   * chases it as a coverage gap. Every teardown step is already idempotent - unbinding an unbound
   * listener, detaching a detached bar and removing an absent style property are all no-ops - so the
   * guard changes nothing observable. It is an equivalent mutant, not a hole in the test.
   *
   * The test is still worth having: it fails if `disable` stops clearing its own `enabled` flag,
   * which is a real regression that would leave the module unable to be switched back on.
   */
  it('tolerates being disabled twice', () => {
    const module = build();
    module.enable();
    module.disable();

    expect(() => {
      module.disable();
    }).not.toThrow();
    expect(module.isEnabled()).toBe(false);
  });

  it('can be switched back on afterwards, since the scene control toggles', () => {
    const module = build();
    module.enable();
    module.disable();

    module.enable();

    expect(module.isEnabled()).toBe(true);
    expect(module.getModifierBar().isAttached()).toBe(true);
  });
});
