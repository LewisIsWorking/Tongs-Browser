import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VIRTUAL_POINTER_ID } from '../../src/constants.js';
import {
  NativePointerSuppressor,
  SUPPRESSED_POINTER_EVENTS,
} from '../../src/gesture/NativePointerSuppressor.js';

/**
 * Keeping the browser's own touch derived pointer events away from PIXI.
 *
 * ⚠️ Every assertion here comes from a device report that showed roughly two hundred
 * `_onDragLeftCancel` calls, each triggered by an event with `pointerType: 'touch'`, while the
 * gesture layer was already "suppressing" exactly those.
 */
let suppressor: NativePointerSuppressor | null = null;
let excluded: EventTarget | null = null;

const make = (enabled = true) => {
  suppressor?.unbind();
  suppressor = new NativePointerSuppressor({
    window,
    enabled: () => enabled,
    isExcluded: (target) => target === excluded,
  });
  suppressor.bind();
  return suppressor;
};

/** A listener registered AFTER ours, on the same node and phase, exactly as PIXI's is. */
const pixiListener = (type: string) => {
  const seen = vi.fn();
  window.addEventListener(type, seen, { capture: true });
  return seen;
};

const finger = (type: string, overrides: PointerEventInit = {}) =>
  new PointerEvent(type, { pointerType: 'touch', pointerId: 1, bubbles: true, ...overrides });

beforeEach(() => {
  document.body.innerHTML = '';
  excluded = null;
  suppressor?.unbind();
  suppressor = null;
});

describe('which events are suppressed', () => {
  /**
   * ⚠️ `pointerover` and `pointerout` were never suppressed at all, and the device report opens with
   * `manager.cancel at GRABBED [pointerover ... touch]`. Foundry's MouseInteractionManager binds
   * both, so a finger passing over anything can end an interaction that is already in progress.
   */
  it('covers every pointer event Foundry or PIXI listens for', () => {
    expect([...SUPPRESSED_POINTER_EVENTS]).toEqual([
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'pointerover',
      'pointerout',
      'pointerenter',
      'pointerleave',
    ]);
  });

  it.each([...SUPPRESSED_POINTER_EVENTS])('stops a real finger %s', (type) => {
    make();
    const pixi = pixiListener(type);

    window.dispatchEvent(finger(type));

    expect(pixi).not.toHaveBeenCalled();
  });
});

describe('what gets through', () => {
  /**
   * ⚠️ Ours must pass. The virtual pointer dispatches with `pointerType: 'mouse'`, which is the
   * whole basis of the module: a suppressor that swallowed those would stop the pointer working.
   */
  it('lets the module’s own pointer through', () => {
    make();
    const pixi = pixiListener('pointerup');

    window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse', bubbles: true }));

    expect(pixi).toHaveBeenCalled();
  });

  it('lets anything carrying the reserved id through, whatever it claims to be', () => {
    make();
    const pixi = pixiListener('pointerup');

    window.dispatchEvent(finger('pointerup', { pointerId: VIRTUAL_POINTER_ID }));

    expect(pixi).toHaveBeenCalled();
  });

  it('leaves excluded regions their native behaviour', () => {
    const chat = document.createElement('div');
    document.body.append(chat);
    excluded = chat;
    make();
    const pixi = pixiListener('pointerup');

    chat.dispatchEvent(finger('pointerup'));

    expect(pixi).toHaveBeenCalled();
  });

  it('does nothing at all when suppression is switched off', () => {
    make(false);
    const pixi = pixiListener('pointerup');

    window.dispatchEvent(finger('pointerup'));

    expect(pixi).toHaveBeenCalled();
  });
});

describe('binding', () => {
  /**
   * ⚠️ IMMEDIATE propagation, not plain. PIXI's listener is on the SAME node, and `stopPropagation`
   * only stops listeners on OTHER nodes: it would leave PIXI's untouched, which is the entire
   * failure this class exists to fix. The `pixiListener` above is registered on the window exactly
   * as PIXI registers its own, so a plain stop would not satisfy these tests.
   */
  it('stops a listener on the same node, which plain propagation would not', () => {
    make();
    const sameNode = pixiListener('pointerup');

    window.dispatchEvent(finger('pointerup'));

    expect(sameNode).not.toHaveBeenCalled();
  });

  it('is idempotent, so a second bind does not double the listeners', () => {
    const instance = make();
    instance.bind();
    const pixi = pixiListener('pointerup');

    window.dispatchEvent(finger('pointerup'));

    expect(pixi).not.toHaveBeenCalled();
  });

  it('lets everything through again once unbound', () => {
    const instance = make();
    instance.unbind();
    const pixi = pixiListener('pointerup');

    window.dispatchEvent(finger('pointerup'));

    expect(pixi).toHaveBeenCalled();
  });

  it('does nothing on an unbind that has nothing to unbind', () => {
    expect(() => {
      new NativePointerSuppressor({
        window,
        enabled: () => true,
        isExcluded: () => false,
      }).unbind();
    }).not.toThrow();
  });
});
