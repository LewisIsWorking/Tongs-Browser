import { afterEach, describe, expect, it } from 'vitest';

import { ExclusionZones } from '../../src/gesture/ExclusionZones.js';
import { TouchBinder } from '../../src/gesture/TouchBinder.js';
import { VIRTUAL_POINTER_ID } from '../../src/constants.js';

/**
 * `pointercancel` from the real finger must never reach Foundry.
 *
 * A touchscreen fires it whenever the browser takes a gesture over: a scroll, an edge swipe, a
 * second finger, a system gesture. A mouse never fires it, which is why desktop has never seen this
 * and why it took a device to find.
 *
 * Foundry's MouseInteractionManager treats a cancel as an ABORT: it resets the interaction and
 * discards `interactionData`, including the `screenOrigin` its 10px drag gate measures from. One
 * stray cancel mid grab therefore ends the drag silently, leaving the state at GRABBED with no
 * preview and a token that does not move.
 *
 * Measured on a OnePlus 13, Chrome 150, Foundry 14.365: 55 drag moves dispatched with Foundry's drag
 * origin readable for only 2 of them, against desktop keeping its origin for every step of the same
 * gesture.
 */
const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
  document.body.innerHTML = '';
});

function bind() {
  const binder = new TouchBinder({
    target: document,
    exclusions: new ExclusionZones({}),
    onInput: () => undefined,
    suppressNativeTouch: () => true,
    now: () => 0,
  });
  binder.bind();
  cleanups.push(() => {
    binder.unbind();
  });

  // A listener standing in for Foundry and PIXI, which listen in the bubble phase on descendants of
  // the document. If the suppressor works, nothing reaches here.
  const reached: string[] = [];
  const target = document.createElement('div');
  document.body.append(target);
  target.addEventListener('pointercancel', (event) => reached.push(event.type));
  target.addEventListener('pointerup', (event) => reached.push(event.type));

  return { reached, target };
}

function pointer(type: string, init: { pointerType: string; pointerId: number }) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerType', { value: init.pointerType });
  Object.defineProperty(event, 'pointerId', { value: init.pointerId });
  return event;
}

describe('TouchBinder native pointer suppression', () => {
  it('stops a real finger pointercancel from reaching Foundry', () => {
    const { reached, target } = bind();

    target.dispatchEvent(pointer('pointercancel', { pointerType: 'touch', pointerId: 1 }));

    expect(reached).toEqual([]);
  });

  /**
   * Our own cancel must still get through. `VirtualPointer.cancelDrag` sends one so that Foundry
   * releases a held button when a gesture is abandoned; swallowing it would leave a token stuck to
   * the pointer, which is the bug this whole suppression exists to avoid causing.
   */
  it('lets OUR pointercancel through, so an abandoned drag can still be released', () => {
    const { reached, target } = bind();

    target.dispatchEvent(
      pointer('pointercancel', { pointerType: 'mouse', pointerId: VIRTUAL_POINTER_ID })
    );

    expect(reached).toEqual(['pointercancel']);
  });

  it('lets a real MOUSE pointercancel through, since it is not a touch to suppress', () => {
    const { reached, target } = bind();

    target.dispatchEvent(pointer('pointercancel', { pointerType: 'mouse', pointerId: 1 }));

    expect(reached).toEqual(['pointercancel']);
  });

  /** The suppression is opt out, and switching it off must switch off all four alike. */
  it('passes a finger pointercancel through when suppression is disabled', () => {
    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones({}),
      onInput: () => undefined,
      suppressNativeTouch: () => false,
      now: () => 0,
    });
    binder.bind();
    cleanups.push(() => {
      binder.unbind();
    });

    const reached: string[] = [];
    const target = document.createElement('div');
    document.body.append(target);
    target.addEventListener('pointercancel', (event) => reached.push(event.type));

    target.dispatchEvent(pointer('pointercancel', { pointerType: 'touch', pointerId: 1 }));

    expect(reached).toEqual(['pointercancel']);
  });

  /**
   * An excluded region, such as the chat log, keeps its own touch handling. A cancel there belongs
   * to whatever the user is scrolling and must not be swallowed either.
   */
  it('passes a finger pointercancel through inside an excluded region', () => {
    const excluded = document.createElement('div');
    excluded.setAttribute('data-tongs-browser', 'ignore');
    document.body.append(excluded);

    const binder = new TouchBinder({
      target: document,
      exclusions: new ExclusionZones({}),
      onInput: () => undefined,
      suppressNativeTouch: () => true,
      now: () => 0,
    });
    binder.bind();
    cleanups.push(() => {
      binder.unbind();
    });

    const reached: string[] = [];
    excluded.addEventListener('pointercancel', (event) => reached.push(event.type));

    excluded.dispatchEvent(pointer('pointercancel', { pointerType: 'touch', pointerId: 1 }));

    expect(reached).toEqual(['pointercancel']);
  });
});
