import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildBarChrome, type BarChromeHandlers } from '../../src/modifiers/BarChrome.js';
import { ExclusionZones } from '../../src/gesture/ExclusionZones.js';
import { ModifierBar } from '../../src/modifiers/ModifierBar.js';
import { KeyboardSynthesizer } from '../../src/modifiers/KeyboardSynthesizer.js';

/**
 * The one marker that lets the bar be dragged at all, checked from BOTH ends. Written 2026-08-14.
 *
 * ⚠️ WHY THIS IS ITS OWN SUITE. `BarChrome` writes `data-tongs-native-pointer` onto the drag handle
 * and `ExclusionZones.needsNativePointerEvents` reads it; the suppressor then lets those events
 * through instead of stopping them at the window in the capture phase. Delete the attribute, or
 * rename it on one side only, and the bar becomes immovable on a real device while every existing
 * test stays green - which is precisely the bug that shipped in 0.25.52 and was reported as "I can't
 * move the tongs toolbox now."
 *
 * A constant shared between a writer and a reader is only safe if something exercises the pair. Both
 * halves import the same constant today, so this suite is not really guarding a typo: it is guarding
 * somebody deciding the attribute is unused, because nothing visibly depended on it.
 */
let handlers: BarChromeHandlers;

beforeEach(() => {
  document.body.innerHTML = '';
  handlers = {
    onHandlePointerDown: vi.fn(),
    onHandlePointerMove: vi.fn(),
    onHandlePointerUp: vi.fn(),
    onCollapseToggled: vi.fn(),
  };
});

const chrome = () => buildBarChrome(document, handlers);

/** The real predicate, not a stand-in, so a rename on either side fails here. */
const zones = new ExclusionZones();

describe('the drag handle, as the suppressor sees it', () => {
  it('is exempted from suppression, so its pointer events reach it', () => {
    const handle = chrome().root.querySelector('.tb-modifier-bar__handle');

    expect(handle).not.toBeNull();
    expect(zones.needsNativePointerEvents(handle)).toBe(true);
  });

  /**
   * ⚠️ The carve-out must stay NARROW. A tray button's pointerup reaching PIXI runs
   * `#handlePointerUp`, which ends in `#handleDragCancel` and throws away a held token drag. That is
   * what would break tapping DROP at the end of a drag.
   */
  it('does not exempt the collapse button beside it', () => {
    const collapse = chrome().root.querySelector('.tb-modifier-bar__collapse');

    expect(collapse).not.toBeNull();
    expect(zones.needsNativePointerEvents(collapse)).toBe(false);
  });

  /** Both questions are still true of it: ours, and exempt. They are not alternatives. */
  it('is still our own interface, which is what keeps the gesture layer off it', () => {
    const handle = chrome().root.querySelector('.tb-modifier-bar__handle');

    expect(zones.isOwnInterface(handle)).toBe(true);
  });
});

/**
 * ⚠️ THE CROSS PRODUCT of the two changes shipped on 2026-08-13, which were written a few hours
 * apart and never checked against each other: the handle became load bearing, and collapsed became
 * the default. A collapse that hid the handle would re-break the bug that had just been fixed, and
 * would do it for every user on their very first launch.
 *
 * `applyCollapsed` hides the KEYS container only, which is why this passes today. It is asserted
 * because nothing else stops a future collapse from hiding more.
 */
describe('what survives a collapse', () => {
  const bar = () => {
    const manager = { downKeys: new Set<string>() };
    return new ModifierBar({
      document,
      synthesizer: new KeyboardSynthesizer({ document, getKeyboardManager: () => manager }),
      onFlagsChanged: () => undefined,
      initialCollapsed: true,
    });
  };

  it('keeps the drag handle, so a bar that opens collapsed can still be moved', () => {
    const handle = bar().getElement().querySelector<HTMLElement>('.tb-modifier-bar__handle');

    expect(handle).not.toBeNull();
    expect(handle?.style.display).not.toBe('none');
    expect(zones.needsNativePointerEvents(handle)).toBe(true);
  });

  it('hides the modifier keys, which is the point of collapsing', () => {
    const keys = bar().getElement().querySelector<HTMLElement>('.tb-modifier-bar__keys');

    expect(keys?.style.display).toBe('none');
  });
});
