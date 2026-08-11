import { afterEach, describe, expect, it } from 'vitest';

import { ExclusionZones } from '../../src/gesture/ExclusionZones.js';
import { TouchBinder } from '../../src/gesture/TouchBinder.js';

/**
 * Raw touch events must never reach PIXI, and `preventDefault` does not stop them.
 *
 * This is the bug the whole drag investigation was chasing. The handlers called `preventDefault()`
 * and stopped there, which prevents scrolling and the browser's compatibility mouse events, and does
 * nothing whatever about propagation. **PIXI listens for `touchstart`, `touchmove` and `touchend`
 * itself** and normalises them into its own pointer events, so the real finger was driving PIXI in
 * parallel with the virtual pointer the entire time.
 *
 * Foundry then saw two interactions: ours, holding a button on the token, and the finger's, starting
 * wherever the finger actually was, which is never on the token because putting the pointer
 * somewhere the finger is not is the entire purpose of this module. The finger's stream destroyed the
 * token's `interactionData`, so the drag gate had nothing to measure from and the state never left
 * GRABBED.
 *
 * Measured on a OnePlus 13, Chrome 150, Foundry 14.365. Driving the SAME device through the module's
 * own pointer, with no finger involved, the drag works and `screenOrigin` stays pinned for 12 of 12
 * samples. A finger doing the same gesture got 2 of 235, and the token never moved.
 */
const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
  document.body.innerHTML = '';
});

function touchEvent(type: string) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: { length: 0, item: () => null } });
  return event;
}

function bind(suppress = true) {
  const inputs: string[] = [];
  const binder = new TouchBinder({
    target: document,
    exclusions: new ExclusionZones({}),
    onInput: (input) => inputs.push(input.type),
    suppressNativeTouch: () => suppress,
    now: () => 0,
  });
  binder.bind();
  cleanups.push(() => {
    binder.unbind();
  });

  // Stands in for PIXI, which listens on the canvas: a descendant of the document.
  const reachedPixi: string[] = [];
  const canvasStandIn = document.createElement('canvas');
  document.body.append(canvasStandIn);
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    canvasStandIn.addEventListener(type, (event) => reachedPixi.push(event.type));
  }

  return { inputs, reachedPixi, canvasStandIn };
}

describe('TouchBinder and the raw touch stream', () => {
  it.each(['touchstart', 'touchmove', 'touchend', 'touchcancel'])(
    'stops %s from reaching PIXI',
    (type) => {
      const { reachedPixi, canvasStandIn } = bind();

      canvasStandIn.dispatchEvent(touchEvent(type));

      expect(reachedPixi).toEqual([]);
    }
  );

  /**
   * Stopping propagation must not stop the gesture layer itself hearing the touch. The module IS the
   * finger's consumer; swallowing the event before reading it would disable every gesture at once.
   */
  it('still feeds every touch into the gesture layer', () => {
    const { inputs, canvasStandIn } = bind();

    canvasStandIn.dispatchEvent(touchEvent('touchstart'));
    canvasStandIn.dispatchEvent(touchEvent('touchmove'));
    canvasStandIn.dispatchEvent(touchEvent('touchend'));
    canvasStandIn.dispatchEvent(touchEvent('touchcancel'));

    expect(inputs).toEqual(['touchstart', 'touchmove', 'touchend', 'touchcancel']);
  });

  /**
   * The suppression is separately toggleable so this module can coexist with another that binds the
   * same events, TouchVTT in particular. Switching it off must let the raw stream through again.
   */
  it('lets the raw touch through when suppression is switched off', () => {
    const { inputs, reachedPixi, canvasStandIn } = bind(false);

    canvasStandIn.dispatchEvent(touchEvent('touchstart'));
    canvasStandIn.dispatchEvent(touchEvent('touchmove'));

    expect(reachedPixi).toEqual(['touchstart', 'touchmove']);
    // And the gesture layer still gets them, because that half is not what the setting controls.
    expect(inputs).toEqual(['touchstart', 'touchmove']);
  });

  /**
   * An excluded region, chat above all, keeps its own touch handling and its own scrolling. It must
   * be untouched whether suppression is on or off.
   */
  it('leaves an excluded region entirely alone', () => {
    const excluded = document.createElement('div');
    excluded.setAttribute('data-tongs-browser', 'ignore');
    document.body.append(excluded);

    const { inputs } = bind();
    const reached: string[] = [];
    excluded.addEventListener('touchmove', (event) => reached.push(event.type));

    excluded.dispatchEvent(touchEvent('touchmove'));

    expect(reached).toEqual(['touchmove']);
    expect(inputs).toEqual([]);
  });
});
