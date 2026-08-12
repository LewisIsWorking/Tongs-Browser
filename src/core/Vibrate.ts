/**
 * Haptic feedback, where the device has any. Extracted from TongsBrowser 2026-08-12.
 */

/**
 * ⚠️ Feature detected at the CALL SITE rather than trusted from the type.
 *
 * `lib.dom` declares `navigator.vibrate` as always present, so nothing in the type system objects to
 * calling it. It is absent on iOS entirely, and on Android it is silently IGNORED until the page has
 * been interacted with, which means a haptic that never fires is indistinguishable from one that
 * fired and was not felt.
 */
export function vibrate(win: Window, durationMs: number): void {
  const target = win.navigator;
  if (typeof target.vibrate === 'function') {
    target.vibrate(durationMs);
  }
}
