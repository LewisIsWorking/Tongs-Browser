/**
 * Where the modifier bar sits, in viewport pixels. Extracted 2026-08-12.
 *
 * Its own file so that `BarClamp` can describe a position without importing `ModifierBar`, which
 * imports `BarClamp`. A shared type in the file that owns the behaviour is how that cycle starts.
 */
export interface BarPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Where the bar sits before anyone drags it. Changed 2026-08-09.
 *
 * ⚠️ It used to be x 16, which put it straight on top of Foundry's scene controls. Measured on a
 * live 14.365: the scene control toolbar occupies x 12 to 66 down the whole left edge, and the bar
 * is 54px tall starting at y 120, so it covered the toolbar between y 120 and 174. The module's own
 * enable and disable toggle, which lives in that toolbar, sat at x 42 to 66 and y 132 to 156,
 * entirely underneath the bar. elementFromPoint at the toggle's centre returned the bar's collapse
 * button.
 *
 * That is the worst possible thing to cover. The scene control toggle exists precisely so there is
 * a way to switch the module off when the pointer is misbehaving, and it was unreachable by a real
 * finger from the moment the bar appeared.
 *
 * 88 clears the toolbar with room to spare on any viewport wide enough for Foundry to run at all,
 * which is at least 1366px. The position is remembered once dragged, so this only ever decides the
 * first launch.
 */
export const DEFAULT_POSITION: BarPosition = { x: 88, y: 120 };
