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
