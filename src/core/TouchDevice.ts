/**
 * Whether this device wants a finger driven pointer at all. Added 2026-09-07.
 *
 * ⛔ THE BUG THIS FIXES. `Enabled` defaulted to `true` everywhere, so opening Foundry on a desktop
 * got a virtual cursor, a modifier bar and the whole interface shrunk to 75%, none of which a mouse
 * needs. The module had NO device detection of any kind: the only `navigator.userAgent` in the
 * codebase is a line in the diagnostics report, and nothing has ever read it to decide anything.
 *
 * ⚠️ NOT user agent sniffing, deliberately. The string lies by design, browsers freeze and remove
 * parts of it, and every table of "is this a phone" substrings rots. What is being asked is not
 * "which device is this" but "is the primary pointing device a finger", and CSS answers that
 * directly.
 *
 * `(pointer: coarse)` is the PRIMARY input's precision, which is the question:
 *
 *   phone or tablet          coarse primary                 -> on
 *   desktop with a mouse     fine primary                   -> off
 *   touchscreen laptop       fine primary, coarse available -> off, which is right: the mouse is
 *                            there, and a virtual cursor driven by a real cursor is absurd
 *
 * ⚠️ It is a DEFAULT, never a lock. Every one of those cases has someone who wants the other answer,
 * a tablet with a keyboard case being the obvious one, so the setting and the scene control toggle
 * both stay exactly as they were. This decides what happens before anybody has an opinion.
 */

/** The slice of `window` this needs, so a test can supply either answer without a browser. */
export interface PointerCapableWindow {
  readonly matchMedia?: (query: string) => { readonly matches: boolean };
  readonly navigator?: { readonly maxTouchPoints?: number };
}

export const COARSE_POINTER_QUERY = '(pointer: coarse)';

/**
 * ⚠️ `maxTouchPoints` is the FALLBACK, not the primary test, and the order matters. It reports
 * whether touch hardware EXISTS, not whether it is what the user is holding, so a touchscreen laptop
 * answers yes and would have the module switch itself on beside a perfectly good mouse. It is here
 * only for a browser too old for `matchMedia`, where a wrong guess beats no guess.
 *
 * ⚠️ Absent everything, returns FALSE. The failure direction is deliberate: a phone with the module
 * off shows a normal Foundry the user can switch the module on in, while a desktop with it on shows
 * a shrunken interface with a cursor fighting the real one, and the control to fix that is inside
 * the thing misbehaving.
 */
export function looksLikeTouchDevice(win: PointerCapableWindow): boolean {
  const media = win.matchMedia;
  if (typeof media === 'function') {
    return media.call(win, COARSE_POINTER_QUERY).matches;
  }

  const points = win.navigator?.maxTouchPoints;
  return typeof points === 'number' && points > 0;
}

/**
 * What to say about the decision, said either way.
 *
 * ⛔ ALWAYS logged, not only when the answer is interesting, because "the module did nothing on my
 * desktop" and "the module failed to load" look identical from outside. One line is the entire
 * difference between a user who knows to flip a switch and one who files a bug.
 *
 * ⚠️ Lives here rather than as a ternary at the composition root, so both halves are reachable by a
 * test. In `main.ts` it was two branches that no test could enter, which is how a message nobody has
 * ever read ends up saying the wrong thing.
 */
export function describeDeviceChoice(touch: boolean): string {
  return touch
    ? 'A coarse pointer is the primary input, so the module starts enabled.'
    : 'No coarse pointer, so this looks like a desktop and the module starts disabled. Turn it on ' +
        'in the module settings, or with the scene control, if that is wrong.';
}
