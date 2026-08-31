import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildParts } from './support/canvasParts.js';
import { makeTouchEvent } from './support/touchEvents.js';
import { stubFoundryEnvironment } from './support/moduleUnderTest.js';

/**
 * The haptic thunk, reached only by holding a finger still long enough. Written 2026-09-01.
 *
 * ⚠️ The last uncalled thunk in `ModuleParts`, and the longest chain of any of them: a touch starts a
 * timer, the timer fires a long press, the long press emits a vibrate action, the controller calls the
 * thunk, and the thunk feature-detects `navigator.vibrate`. Every link is somewhere else, which is
 * exactly why no focused suite reached it.
 *
 * ⚠️ The feature detection is the point rather than a formality. `lib.dom` declares
 * `navigator.vibrate` as always present, so nothing in the type system objects to calling it. It is
 * absent on iOS entirely. A thunk that called it unguarded would throw inside the long press handler
 * on every iOS hold, which is a broken gesture rather than a missing buzz.
 *
 * COVERS: the vibrate thunk being unwired, and the guard being dropped.
 * MISSES: whether the device actually buzzes. Android ignores `vibrate` silently until the page has
 *   been interacted with, so only a hand test on hardware can close that, and MANUAL-TESTING.md asks
 *   for it.
 */
const nav = window.navigator as Navigator & { vibrate?: (ms: number) => boolean };

function stubVibrate(): (ms: number) => boolean {
  const spy = vi.fn(() => true);
  Object.defineProperty(nav, 'vibrate', { value: spy, configurable: true, writable: true });
  return spy;
}

function removeVibrate(): void {
  Reflect.deleteProperty(nav, 'vibrate');
}

/** A finger down and held still, with the long press timer allowed to fire. */
function holdFinger(): void {
  document.dispatchEvent(
    makeTouchEvent('touchstart', [{ identifier: 1, clientX: 50, clientY: 50 }])
  );
  vi.advanceTimersByTime(1000);
}

beforeEach(() => {
  vi.useFakeTimers();
  stubFoundryEnvironment();
});

afterEach(() => {
  vi.useRealTimers();
  removeVibrate();
});

describe('holding a finger still', () => {
  it('buzzes the device through the module wiring', () => {
    const vibrate = stubVibrate();
    buildParts().binder.bind();

    holdFinger();

    expect(vibrate).toHaveBeenCalled();
  });

  it('asks for a duration rather than buzzing indefinitely', () => {
    const vibrate = stubVibrate();
    buildParts().binder.bind();

    holdFinger();

    const [duration] = (vibrate as unknown as { mock: { calls: number[][] } }).mock.calls[0] ?? [];
    expect(duration).toBeGreaterThan(0);
  });

  /**
   * ⚠️ A device with no vibrator must still complete the long press. The guard lives in
   * `core/Vibrate.ts` and this asserts it survives the whole chain: without it, every hold on iOS
   * would throw inside the gesture handler and take the gesture with it.
   */
  it('completes the long press on a device with no vibrator', () => {
    removeVibrate();
    const parts = buildParts();
    parts.binder.bind();

    expect(() => {
      holdFinger();
    }).not.toThrow();
  });

  /** ⚠️ A tap that ends before the timer must NOT buzz, or every tap would feel like a hold. */
  it('does not buzz for a touch that ends before the timer', () => {
    const vibrate = stubVibrate();
    buildParts().binder.bind();

    document.dispatchEvent(
      makeTouchEvent('touchstart', [{ identifier: 1, clientX: 50, clientY: 50 }])
    );
    document.dispatchEvent(makeTouchEvent('touchend', []));
    vi.advanceTimersByTime(1000);

    expect(vibrate).not.toHaveBeenCalled();
  });
});
