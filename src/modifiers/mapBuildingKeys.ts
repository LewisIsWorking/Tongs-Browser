import type { KeyDefinition } from './keyDefinitions.js';

/**
 * The keys behind the GM map-building buttons. Added 2026-09-09. None of them goes on the bar.
 *
 * ⛔ FOUR ARE CHORDS AND TWO ARE NOT, and that asymmetry is measured rather than assumed. Read out of
 * `scripts/keybindings/snapshot.ts`, which was taken from Foundry 14.366's own registration file:
 *
 *     selectAll  CONTROL+KeyA      sendToBack    BracketLeft
 *     cut        CONTROL+KeyX      bringToFront  BracketRight
 *     copy       CONTROL+KeyC
 *     paste      CONTROL+KeyV
 *
 * ⛔ THE Z-ORDER PAIR TAKE NO MODIFIER. Sending Ctrl+[ would be a chord Foundry does not bind, so the
 * button would do nothing whatsoever while looking exactly like the four beside it that work. These
 * six are alike in what they are FOR, and grouping by purpose invites the assumption that they are
 * therefore alike in HOW they are sent. They are not, and that is the whole reason this file states
 * each one rather than deriving them from a list of letters.
 *
 * ⚠️ Same reason as `UNDO_KEY` for why none of these is a bar key: a bare A, X, C or V button would
 * send a key Foundry already binds to something else entirely (`moveLeft`, `characterSheet`), so on
 * its own it is a control that does the wrong thing rather than nothing. The chord is what has a
 * meaning, so the chord is what gets a button.
 *
 * ⚠️ Extracted rather than added to `keyDefinitions.ts`, which is at 107 of the 200 line limit. The
 * size rule says extract, and these genuinely are a separate idea: that file describes the keys the
 * BAR offers, and every key here is deliberately absent from it.
 */
export const SELECT_ALL_KEY: KeyDefinition = Object.freeze({
  code: 'KeyA',
  key: 'a',
  keyCode: 65,
  label: 'A',
  sticky: false,
});

export const CUT_KEY: KeyDefinition = Object.freeze({
  code: 'KeyX',
  key: 'x',
  keyCode: 88,
  label: 'X',
  sticky: false,
});

export const COPY_KEY: KeyDefinition = Object.freeze({
  code: 'KeyC',
  key: 'c',
  keyCode: 67,
  label: 'C',
  sticky: false,
});

export const PASTE_KEY: KeyDefinition = Object.freeze({
  code: 'KeyV',
  key: 'v',
  keyCode: 86,
  label: 'V',
  sticky: false,
});

/** ⚠️ NO modifier. See the block above: Ctrl+[ is not a binding Foundry has. */
export const SEND_TO_BACK_KEY: KeyDefinition = Object.freeze({
  code: 'BracketLeft',
  key: '[',
  keyCode: 219,
  label: '[',
  sticky: false,
});

/** ⚠️ NO modifier, as above. */
export const BRING_TO_FRONT_KEY: KeyDefinition = Object.freeze({
  code: 'BracketRight',
  key: ']',
  keyCode: 221,
  label: ']',
  sticky: false,
});
