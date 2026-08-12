import { describe, expect, it } from 'vitest';

import {
  TOUCH_LISTENER_SPECS,
  toListenerOptions,
  type TouchListenerSpec,
} from '../../src/gesture/TouchListenerSpecs.js';

/**
 * Which listeners the touch binder installs, and on what terms.
 *
 * ⚠️ Every entry encodes a bug that took a physical device to find, and each is ONE OPTION FLAG away
 * from silently not working. A bubble phase listener still fires. A passive one still runs. Both look
 * completely normal in a debugger while the behaviour they exist to prevent goes right past them.
 * That is why these are asserted as data rather than trusted as a run of addEventListener calls.
 */
const find = (type: string): TouchListenerSpec => {
  const spec = TOUCH_LISTENER_SPECS.find((candidate) => candidate.type === type);
  if (spec === undefined) {
    throw new Error(`no listener registered for '${type}'`);
  }
  return spec;
};

describe('TOUCH_LISTENER_SPECS', () => {
  /**
   * ⚠️ The roster test, and it is the one that would have caught the longest running bug here.
   *
   * `pointercancel` was missing for weeks. A touchscreen fires it whenever the browser takes a
   * gesture over, a mouse never fires it at all, and Foundry treats it as an ABORT that discards the
   * drag origin its 10px gate measures from. Desktop could not see the gap, and nothing in the code
   * looked wrong: the three siblings were right there, and the fourth simply was not.
   */
  it('registers every event the module has to intercept, and no others', () => {
    expect(TOUCH_LISTENER_SPECS.map((spec) => spec.type)).toEqual([
      'touchstart',
      'touchmove',
      'touchend',
      'touchcancel',
      'contextmenu',
    ]);
  });

  /**
   * ⚠️ CAPTURE on every one, which is the whole fix rather than a preference. PIXI listens for raw
   * touch ITSELF, so a bubble phase listener that calls preventDefault stops scrolling and does not
   * stop PIXI: the real finger drives Foundry in parallel with the virtual pointer, and the finger's
   * stream destroys the token's interactionData.
   */
  it('captures every single one, without exception', () => {
    for (const spec of TOUCH_LISTENER_SPECS) {
      expect(spec.capture).toBe(true);
    }
  });

  /**
   * ⚠️ A passive listener CANNOT preventDefault, and the browser silently ignores the attempt rather
   * than reporting it. No error, no warning, and nothing in the code to say the call did nothing.
   */
  it.each(['touchstart', 'touchmove', 'touchend', 'touchcancel'])(
    '%s is non passive, because it calls preventDefault',
    (type) => {
      expect(find(type).passive).toBe(false);
    }
  );

  it('gives every listener a reason, since none of these are obvious', () => {
    for (const spec of TOUCH_LISTENER_SPECS) {
      expect(spec.because.length).toBeGreaterThan(20);
    }
  });

  it('intercepts contextmenu, which Foundry maps straight to its drag cancel', () => {
    expect(find('contextmenu').handler).toBe('onNativeContextMenu');
  });

  it('routes each touch type to its own handler', () => {
    expect(find('touchstart').handler).toBe('onTouchStart');
    expect(find('touchmove').handler).toBe('onTouchMove');
    expect(find('touchend').handler).toBe('onTouchEnd');
    expect(find('touchcancel').handler).toBe('onTouchCancel');
  });
});

describe('toListenerOptions', () => {
  const signal = new AbortController().signal;

  it('carries the abort signal, so unbind removes everything at once', () => {
    expect(toListenerOptions(find('touchstart'), signal).signal).toBe(signal);
  });

  it('sets passive false where the spec says so', () => {
    expect(toListenerOptions(find('touchmove'), signal)).toEqual({
      capture: true,
      passive: false,
      signal,
    });
  });

  /**
   * Omitted rather than set to true. `exactOptionalPropertyTypes` aside, an explicit `passive: true`
   * would be a claim this listener never calls preventDefault, and the pointer handlers do not make
   * that promise: they stop propagation, and the default stays the browser's to decide.
   */
  it('leaves passive unset where the spec does not name it', () => {
    expect(toListenerOptions(find('contextmenu'), signal)).toEqual({ capture: true, signal });
    expect('passive' in toListenerOptions(find('contextmenu'), signal)).toBe(false);
  });
});
