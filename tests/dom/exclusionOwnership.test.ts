import { beforeEach, describe, expect, it } from 'vitest';

import {
  IGNORE_ATTRIBUTE,
  IGNORE_ATTRIBUTE_VALUE,
  NATIVE_POINTER_ATTRIBUTE,
} from '../../src/constants.js';
import { ExclusionZones } from '../../src/gesture/ExclusionZones.js';

/**
 * Three questions about an element, which are NOT rephrasings of each other.
 *
 * ⚠️ Treating any two of them as one has produced a real bug each time, and only `isExcluded` had
 * tests. The other two are the pair that decides whether a held drag survives a tap on our own bar,
 * and whether the bar can be moved at all.
 *
 *   isExcluded               not ours to touch: chat, inputs, scroll regions
 *   isOwnInterface           this is our own furniture
 *   needsNativePointerEvents ours, and it still needs the browser's real events
 *
 * They are not opposites and they are not nested in the obvious way. Chat is excluded and is not
 * ours. The bar is ours and is also excluded, because it carries the opt-out attribute. The drag
 * handle is all three.
 */
function zones() {
  return new ExclusionZones();
}

function ourBar(): HTMLElement {
  const bar = document.createElement('div');
  bar.setAttribute(IGNORE_ATTRIBUTE, IGNORE_ATTRIBUTE_VALUE);
  document.body.append(bar);
  return bar;
}

function childOf(parent: HTMLElement, attributes: Record<string, string> = {}): HTMLElement {
  const child = document.createElement('button');
  for (const [name, value] of Object.entries(attributes)) {
    child.setAttribute(name, value);
  }
  parent.append(child);
  return child;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('telling our own furniture from somebody else’s', () => {
  it('knows the bar is ours', () => {
    expect(zones().isOwnInterface(ourBar())).toBe(true);
  });

  /**
   * ⚠️ Chat is excluded and is NOT ours, and the difference is load bearing. The gesture layer keeps
   * off both, but the native pointer suppressor must treat them oppositely: chat genuinely needs its
   * own events, while our bar must not leak a `pointerup` to PIXI.
   */
  it('knows the chat log is not ours, even though it is excluded', () => {
    const chat = document.createElement('div');
    chat.id = 'sidebar';
    document.body.append(chat);
    const zone = zones();

    expect(zone.isExcluded(chat)).toBe(true);
    expect(zone.isOwnInterface(chat)).toBe(false);
  });

  it('counts a control inside the bar as ours', () => {
    expect(zones().isOwnInterface(childOf(ourBar()))).toBe(true);
  });

  it('treats the canvas as neither ours nor excluded', () => {
    const board = document.createElement('canvas');
    document.body.append(board);
    const zone = zones();

    expect(zone.isOwnInterface(board)).toBe(false);
    expect(zone.isExcluded(board)).toBe(false);
  });

  it('answers false for a null target rather than throwing', () => {
    expect(zones().isOwnInterface(null)).toBe(false);
  });
});

/**
 * ⚠️ THE NARROW HOLE, and both edges of it were measured bugs.
 *
 * Suppression over our own bar is load bearing: a finger's `pointerup` reaching PIXI runs
 * `#handlePointerUp`, which ends in `#handleDragCancel` and throws away a held token drag. That is
 * what makes tapping DROP work at all. Measured 2026-08-12: one tap on the grab button put seven
 * trusted events on the window, including a `pointerup` with `pointerType: 'touch'`.
 *
 * But the suppressor stops events at the WINDOW in the capture phase, upstream of everything, so
 * "PIXI must not see it" was implemented as "nobody sees it" and the bar's own drag handle stopped
 * receiving the `pointerdown` it is built on. Reported 2026-08-13: "I can't move the tongs toolbox
 * now."
 *
 * So the hole must be exactly the handle: any wider and DROP breaks, any narrower and the bar cannot
 * be moved.
 */
describe('the carve-out for controls that need real pointer events', () => {
  it('lets the drag handle keep its native events', () => {
    const handle = childOf(ourBar(), { [NATIVE_POINTER_ATTRIBUTE]: '' });

    expect(zones().needsNativePointerEvents(handle)).toBe(true);
  });

  /** ⚠️ Any wider and a tap on DROP cancels the drag it was meant to complete. */
  it('does not extend to a tray button beside it', () => {
    const bar = ourBar();
    childOf(bar, { [NATIVE_POINTER_ATTRIBUTE]: '' });
    const tray = childOf(bar);

    expect(zones().needsNativePointerEvents(tray)).toBe(false);
  });

  /** ⚠️ Nor to the bar itself, which would suppress nothing at all. */
  it('does not extend to the bar as a whole', () => {
    expect(zones().needsNativePointerEvents(ourBar())).toBe(false);
  });

  it('still counts the handle as our own furniture', () => {
    const handle = childOf(ourBar(), { [NATIVE_POINTER_ATTRIBUTE]: '' });

    expect(zones().isOwnInterface(handle)).toBe(true);
  });

  it('does not claim somebody else’s element needs them', () => {
    const chat = document.createElement('div');
    chat.id = 'sidebar';
    document.body.append(chat);

    expect(zones().needsNativePointerEvents(chat)).toBe(false);
  });

  it('answers false for a null target rather than throwing', () => {
    expect(zones().needsNativePointerEvents(null)).toBe(false);
  });
});
