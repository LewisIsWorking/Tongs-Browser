import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSuppressor } from '../../src/gesture/BuildSuppressor.js';
import { ExclusionZones } from '../../src/gesture/ExclusionZones.js';
import type { NativePointerSuppressor } from '../../src/gesture/NativePointerSuppressor.js';

/**
 * Composing the native pointer suppressor out of the real exclusion zones.
 *
 * ⚠️ This file shipped at 0% coverage, and it is the composition step where a rule has ALREADY gone
 * missing once. `NativePointerSuppressor` records it: the own-interface rule was first written by
 * composing predicates at this call site, one edit silently failed to apply, and the leak stayed open
 * with the module building and every test passing. The rule was moved inside the class as a result -
 * but the three predicates are still handed over from here, and a predicate that is dropped here is
 * indistinguishable from one that was never needed.
 *
 * So this asserts through REAL DOM EVENTS against the REAL ExclusionZones rather than checking that
 * a factory returned an object. What matters is not that a suppressor exists; it is that the three
 * questions it asks are wired to the three answers.
 */
let suppressor: NativePointerSuppressor | null = null;

afterEach(() => {
  suppressor?.unbind();
  suppressor = null;
  document.body.innerHTML = '';
});

const build = (enabled = true) => {
  suppressor = buildSuppressor({
    window,
    enabled: () => enabled,
    exclusions: new ExclusionZones(),
  });
  return suppressor;
};

/** A listener registered AFTER ours, on the same node and phase, exactly as PIXI's is. */
const pixiListener = (type: string) => {
  const seen = vi.fn();
  window.addEventListener(type, seen, { capture: true });
  return seen;
};

const finger = (type: string) =>
  new PointerEvent(type, { pointerType: 'touch', pointerId: 1, bubbles: true });

const element = (html: string) => {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
};

describe('the suppressor this factory builds', () => {
  it('is already bound, so nothing has to remember to bind it', () => {
    const canvas = element('<canvas id="board"></canvas>');
    build();
    const pixi = pixiListener('pointerup');

    canvas.dispatchEvent(finger('pointerup'));

    expect(pixi).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ Our own bar, which the gesture layer must keep OFF and PIXI must never see. A finger's
   * pointerup reaching PIXI runs `#handlePointerUp`, which ends in `#handleDragCancel` and throws
   * away a held token drag.
   */
  it('stops a finger on our own bar from reaching the canvas', () => {
    const bar = element('<div data-tongs-browser="ignore"><button>drop</button></div>');
    build();
    const pixi = pixiListener('pointerup');

    bar.querySelector('button')?.dispatchEvent(finger('pointerup'));

    expect(pixi).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ The carve-out, wired from here. Without it the bar cannot be dragged at all, because the stop
   * above happens on the window in the capture phase and is upstream of the handle's own listeners.
   */
  it('lets the drag handle keep its pointer events', () => {
    const bar = element(
      '<div data-tongs-browser="ignore"><div data-tongs-native-pointer=""></div></div>'
    );
    const handle = bar.querySelector<HTMLElement>('[data-tongs-native-pointer]');
    const own = vi.fn();
    handle?.addEventListener('pointerdown', own);
    build();

    handle?.dispatchEvent(finger('pointerdown'));

    expect(own).toHaveBeenCalled();
  });

  /** Chat and inputs genuinely need native behaviour, and are not ours to interfere with. */
  it('leaves an excluded region such as the chat log alone', () => {
    const chat = element('<ol class="chat-log"><li>hello</li></ol>');
    build();
    const pixi = pixiListener('pointerup');

    chat.querySelector('li')?.dispatchEvent(finger('pointerup'));

    expect(pixi).toHaveBeenCalled();
  });

  /**
   * ⚠️ Read LIVE on every event, never captured. Nothing unbinds this suppressor, deliberately, so
   * the setting going false is the only thing that makes it inert. A captured boolean would leave a
   * disabled module still swallowing every touch on the page.
   */
  it('goes inert when the module is switched off, without being unbound', () => {
    const canvas = element('<canvas id="board"></canvas>');
    build(false);
    const pixi = pixiListener('pointerup');

    canvas.dispatchEvent(finger('pointerup'));

    expect(pixi).toHaveBeenCalled();
  });
});
