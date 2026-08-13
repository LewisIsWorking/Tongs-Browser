/**
 * Values that are baked into the manifest, the DOM, or the wire, and therefore must not drift.
 */

/** Must match the "id" field in module.json. Used as the settings namespace. */
export const MODULE_ID = 'tongs-browser';

/** Human readable name, used in log output and UI strings. */
export const MODULE_TITLE = 'Tongs Browser';

/**
 * Reserved pointerId for every synthesised pointer event.
 *
 * Real touch points get browser assigned ids starting from low integers, so a high constant keeps
 * the virtual pointer from ever colliding with a genuine finger. That separation is what lets the
 * native touch suppressor tell our events apart from the browser's.
 */
export const VIRTUAL_POINTER_ID = 9001;

/** Marks an element as off limits to the gesture layer. */
export const IGNORE_ATTRIBUTE = 'data-tongs-browser';

/** Attribute value on IGNORE_ATTRIBUTE that opts an element out of gesture handling. */
export const IGNORE_ATTRIBUTE_VALUE = 'ignore';

/**
 * Marks a control inside our own interface that must still receive real pointer events.
 * Added 2026-08-13.
 *
 * ⚠️ A THIRD question about an element, not a rephrasing of the other two. `IGNORE_ATTRIBUTE` says
 * the gesture layer must not synthesise from this element; `isOwnInterface` says PIXI must never see
 * its events. Both are true of the whole bar, and together they stopped the bar's own drag handle
 * working at all: the suppressor calls `stopImmediatePropagation` on the WINDOW in the capture phase,
 * which is upstream of every listener the handle owns.
 *
 * Only the drag handle carries this. The tray buttons must NOT: they work from `click`, and letting
 * their `pointerup` reach PIXI is exactly the leak that cancels a held token drag when you tap DROP.
 */
export const NATIVE_POINTER_ATTRIBUTE = 'data-tongs-native-pointer';
