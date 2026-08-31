import { WindowClampBinder } from '../../../src/scaling/WindowClampBinder.js';

/**
 * Application windows for the clamp suites. Extracted 2026-08-31 when the binding lifecycle needed
 * the same two helpers the clamping suite already had, and copying them would have made two places
 * to keep the jsdom workaround correct.
 */

/**
 * A window with the four layout properties `clampElement` reads.
 *
 * ⚠️ Defined explicitly because jsdom has NO LAYOUT ENGINE and reports zero for every one of them. A
 * suite relying on real layout would clamp a 0x0 box at the origin, decide nothing needed clamping,
 * and pass while asserting nothing at all.
 */
export function makeClampWindow(
  className: string,
  rect: { left: number; top: number; width: number; height: number }
): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  document.body.append(element);

  Object.defineProperty(element, 'offsetLeft', { value: rect.left, configurable: true });
  Object.defineProperty(element, 'offsetTop', { value: rect.top, configurable: true });
  Object.defineProperty(element, 'offsetWidth', { value: rect.width, configurable: true });
  Object.defineProperty(element, 'offsetHeight', { value: rect.height, configurable: true });
  return element;
}

/** A binder against a phone sized viewport, which is the case the class exists for. */
export function clampBinder(): WindowClampBinder {
  return new WindowClampBinder({
    document,
    window: { innerWidth: 400, innerHeight: 800 } as Window,
  });
}
