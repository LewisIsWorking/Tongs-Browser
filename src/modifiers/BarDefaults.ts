/**
 * How the bar opens when nobody has said otherwise. Added 2026-08-13.
 *
 * Separate from `BarPosition`, which owns where it opens, because this is a different question with
 * a different reason behind it, and separate from `ModifierBar` because a product decision buried in
 * a constructor is one nobody finds when they want to change it.
 */

/**
 * ⚠️ Collapsed, changed from expanded 2026-08-13 at the user's request.
 *
 * Expanded, the bar is the full modifier key grid plus the tray, and on the 360x607 viewport this
 * module exists for it covers roughly a quarter of the screen, directly on top of the map being
 * played on.
 *
 * Collapsing is PARTIAL, which is what makes this a reasonable default rather than a module that
 * starts hidden: the tray survives, so the hand, drop, pause and diagnose buttons are all still
 * there. Only the modifier keys go, and the `<` button brings them back in one tap on the rare
 * occasions a phone user wants Ctrl or Alt.
 *
 * A saved preference still wins. This only decides the first launch.
 */
export const DEFAULT_COLLAPSED = true;
