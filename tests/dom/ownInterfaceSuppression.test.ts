import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NativePointerSuppressor } from '../../src/gesture/NativePointerSuppressor.js';

/**
 * Keeping the browser's own touch derived pointer events away from PIXI.
 *
 * ⚠️ Every assertion here comes from a device report that showed roughly two hundred
 * `_onDragLeftCancel` calls, each triggered by an event with `pointerType: 'touch'`, while the
 * gesture layer was already "suppressing" exactly those.
 */
let suppressor: NativePointerSuppressor | null = null;
let excluded: EventTarget | null = null;
let ownUi: EventTarget | null = null;

const make = (enabled = true) => {
  suppressor?.unbind();
  suppressor = new NativePointerSuppressor({
    window,
    enabled: () => enabled,
    isExcluded: (target) => target === excluded,
    isOwnInterface: (target) => target === ownUi,
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
  ownUi = null;
  suppressor?.unbind();
  suppressor = null;
});

describe('the module’s own interface', () => {
  const ourBar = () => {
    const bar = document.createElement('div');
    document.body.append(bar);
    ownUi = bar;
    return bar;
  };

  it('stops a finger’s pointer events even though the bar is an excluded region', () => {
    const bar = ourBar();
    excluded = bar;
    make();
    const pixi = pixiListener('pointerup');

    bar.dispatchEvent(finger('pointerup'));

    expect(pixi).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ The browser emits these from a touch roughly 300ms after touchend, and they are NOT pointer
   * events, so the pointer list does not cover them. They carry no information over our own bar,
   * because the buttons work from `click`.
   */
  it.each(['mousedown', 'mouseup', 'mousemove'])(
    'stops a touch derived %s over our bar',
    (type) => {
      const bar = ourBar();
      make();
      const pixi = pixiListener(type);

      bar.dispatchEvent(new MouseEvent(type, { bubbles: true }));

      expect(pixi).not.toHaveBeenCalled();
    }
  );

  /**
   * ⚠️ `click` must survive, and suppressing it would break the bar to fix the canvas. PIXI does not
   * listen for it, and it is how every tray button works.
   */
  it('lets click through, which is how the buttons work at all', () => {
    const bar = ourBar();
    make();
    const pixi = pixiListener('click');

    bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(pixi).toHaveBeenCalled();
  });

  /**
   * ⚠️ Only over OUR bar. On a desktop these are a real mouse and Foundry needs every one of them,
   * so blanket suppression would make the module unusable with a mouse.
   */
  it('leaves mouse events everywhere else completely alone', () => {
    ourBar();
    make();
    const pixi = pixiListener('mousedown');

    window.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(pixi).toHaveBeenCalled();
  });

  /**
   * ⚠️ The module's own mouse events are dispatched at the POINTER, which is over the canvas, so
   * they are outside our bar and unaffected. Asserted by target rather than by `isTrusted`, because
   * jsdom cannot produce a trusted event and a test of that would pass for the wrong reason.
   */
  it('leaves the module’s own synthesised mouse events alone, since they land on the canvas', () => {
    ourBar();
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    make();
    const pixi = pixiListener('mouseup');

    canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(pixi).toHaveBeenCalled();
  });
});
