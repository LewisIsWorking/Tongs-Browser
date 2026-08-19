/**
 * Which parts of Foundry's interface get scaled, and where each one is anchored.
 *
 * The transform origin has to match where the region is pinned, or scaling pushes it off screen.
 * The right sidebar is anchored to the right edge, so it scales about `top right`; scaling it about
 * the default centre would leave a gap on the right and slide its left edge inward. The same logic
 * applies to each of the four edges.
 *
 * The canvas is deliberately absent. Scaling it would fight Foundry's own zoom, which already owns
 * that transform, and would make the board and the pointer disagree about where things are. Only
 * the HTML chrome is touched.
 */
export interface ScaleRegion {
  /** Selectors tried in order. The first that matches wins, covering markup changes across versions. */
  readonly selectors: readonly string[];
  readonly transformOrigin: string;
  readonly description: string;
}

export const SCALE_REGIONS: readonly ScaleRegion[] = Object.freeze([
  {
    selectors: ['#ui-left', '#controls'],
    transformOrigin: 'top left',
    description: 'Scene controls down the left edge',
  },
  {
    selectors: ['#ui-right', '#sidebar'],
    transformOrigin: 'top right',
    description: 'Sidebar with chat, combat and compendia',
  },
  {
    selectors: ['#ui-top', '#navigation'],
    transformOrigin: 'top center',
    description: 'Scene navigation across the top',
  },
  {
    selectors: ['#ui-bottom', '#players', '#hotbar'],
    transformOrigin: 'bottom left',
    description: 'Hotbar and player list along the bottom',
  },
]);

export const MIN_UI_SCALE = 0.5;
export const MAX_UI_SCALE = 1;
const UI_SCALE_STEP = 0.05;
export const DEFAULT_UI_SCALE = 0.75;

/**
 * Constrains a scale to the supported range and snaps it to the step.
 *
 * Snapping matters because the value reaches here from a settings slider, and an unsnapped
 * 0.7300000000000001 would be written back to settings and shown to the user as is.
 */
export function normaliseScale(scale: number): number {
  if (!Number.isFinite(scale)) {
    return DEFAULT_UI_SCALE;
  }
  const clamped = Math.min(Math.max(scale, MIN_UI_SCALE), MAX_UI_SCALE);
  const stepped = Math.round(clamped / UI_SCALE_STEP) * UI_SCALE_STEP;
  // Rounded to avoid binary floating point noise reaching the stylesheet and the settings store.
  return Math.round(stepped * 100) / 100;
}
