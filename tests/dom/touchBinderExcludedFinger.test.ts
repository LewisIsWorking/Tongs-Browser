import { beforeEach, describe, expect, it } from 'vitest';

import { ExclusionZones } from '../../src/gesture/ExclusionZones.js';
import { TouchBinder } from '../../src/gesture/TouchBinder.js';
import type { GestureInput } from '../../src/gesture/GestureTypes.js';
import { makeTouchEvent } from './support/touchEvents.js';

/**
 * A finger resting in an excluded region must not be counted as half of a two finger gesture.
 * Found by reading, 2026-08-17. No hardware needed to see it, and no hardware needed to fix it.
 *
 * ⚠️ THE MECHANISM, because it is not obvious. `TouchEvent.touches` holds every finger on the
 * SURFACE, not the fingers on the event's target. TouchBinder correctly ignores an event whose target
 * is excluded, so a finger landing in the sidebar tells the state machine nothing. But the NEXT
 * canvas touchmove carries that finger in its `touches` list anyway, and
 * `SingleFingerStates.fromTracking` decides two-fingerness with `input.touches.length >= 2`.
 *
 * So the machine never hears the finger arrive and then counts it regardless. One finger dragging a
 * token turns into a pan or a pinch because the other hand is holding the tablet with a thumb over
 * the sidebar - which is how a tablet is held.
 *
 * ⚠️ Asserting the COUNT the machine receives, not the panning. The desync is in what TouchBinder
 * reports, and a test that drove a pan would pass again the moment the pan threshold changed.
 */
beforeEach(() => {
  document.body.innerHTML = '';
});

function setup() {
  const inputs: GestureInput[] = [];
  const binder = new TouchBinder({
    target: document,
    exclusions: new ExclusionZones(),
    onInput: (input) => inputs.push(input),
    suppressNativeTouch: () => true,
    now: () => 1000,
  });
  binder.bind();
  return { binder, inputs };
}

function board(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  return canvas;
}

function sidebar(): HTMLElement {
  const aside = document.createElement('div');
  aside.id = 'sidebar';
  document.body.append(aside);
  return aside;
}

describe('a second finger in an excluded region', () => {
  it('is not reported as a touch, so the machine never sees two fingers', () => {
    const { binder, inputs } = setup();
    const canvas = board();
    const aside = sidebar();

    canvas.dispatchEvent(
      makeTouchEvent('touchstart', [{ identifier: 1, clientX: 10, clientY: 10, target: canvas }])
    );
    // The sidebar finger lands. Its own event is excluded and correctly reports nothing.
    aside.dispatchEvent(
      makeTouchEvent('touchstart', [
        { identifier: 1, clientX: 10, clientY: 10, target: canvas },
        { identifier: 2, clientX: 900, clientY: 400, target: aside },
      ])
    );
    // The canvas finger moves. This event carries BOTH fingers.
    canvas.dispatchEvent(
      makeTouchEvent('touchmove', [
        { identifier: 1, clientX: 12, clientY: 12, target: canvas },
        { identifier: 2, clientX: 900, clientY: 400, target: aside },
      ])
    );

    const moved = inputs.filter((input) => input.type === 'touchmove');
    expect(moved).toHaveLength(1);
    expect(moved[0]?.type === 'touchmove' && moved[0].touches).toEqual([
      { id: 1, clientX: 12, clientY: 12 },
    ]);
    binder.unbind();
  });

  /** The same desync at the very start: the excluded finger is already down when ours lands. */
  it('is not counted when it was already down before the canvas was touched', () => {
    const { binder, inputs } = setup();
    const canvas = board();
    const aside = sidebar();

    canvas.dispatchEvent(
      makeTouchEvent('touchstart', [
        { identifier: 2, clientX: 900, clientY: 400, target: aside },
        { identifier: 1, clientX: 10, clientY: 10, target: canvas },
      ])
    );

    expect(inputs[0]?.type === 'touchstart' && inputs[0].touches).toEqual([
      { id: 1, clientX: 10, clientY: 10 },
    ]);
    binder.unbind();
  });

  /** touchend carries the same list, so it can desync the release just as easily. */
  it('is not counted on the release either', () => {
    const { binder, inputs } = setup();
    const canvas = board();
    const aside = sidebar();

    canvas.dispatchEvent(
      makeTouchEvent('touchend', [{ identifier: 2, clientX: 900, clientY: 400, target: aside }])
    );

    expect(inputs[0]?.type === 'touchend' && inputs[0].touches).toEqual([]);
    binder.unbind();
  });

  /**
   * ⚠️ TWO fingers on the canvas must still pan. The fix filters by where each finger landed, and a
   * filter that took the count with it would trade a rare misfire for the loss of pan and zoom
   * altogether - the far worse bug, and one nothing else here would catch.
   */
  it('still reports both fingers when both are on the board', () => {
    const { binder, inputs } = setup();
    const canvas = board();

    canvas.dispatchEvent(
      makeTouchEvent('touchmove', [
        { identifier: 1, clientX: 10, clientY: 10, target: canvas },
        { identifier: 2, clientX: 200, clientY: 300, target: canvas },
      ])
    );

    expect(inputs[0]?.type === 'touchmove' && inputs[0].touches).toEqual([
      { id: 1, clientX: 10, clientY: 10 },
      { id: 2, clientX: 200, clientY: 300 },
    ]);
    binder.unbind();
  });

  /**
   * ⚠️ A touch whose target cannot be read is KEPT, not dropped. `Touch.target` is standard but this
   * code runs against whatever a tablet browser actually provides, and "drop what I cannot attribute"
   * would silently disable two finger gestures on any engine that omits it. Keeping is what happens
   * today, so an unreadable target changes nothing rather than breaking something.
   */
  it('keeps a finger whose target cannot be read, rather than silently dropping it', () => {
    const { binder, inputs } = setup();
    const canvas = board();

    canvas.dispatchEvent(
      makeTouchEvent('touchmove', [
        { identifier: 1, clientX: 10, clientY: 10, target: canvas },
        { identifier: 2, clientX: 200, clientY: 300 },
      ])
    );

    expect(inputs[0]?.type === 'touchmove' && inputs[0].touches).toHaveLength(2);
    binder.unbind();
  });
});
