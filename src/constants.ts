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
