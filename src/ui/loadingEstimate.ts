/**
 * 📊 The loading screen's percentage and time left, from the stage Foundry is on and how long each stage took on
 * this world's past loads. Added 2026-11-14 (Lewis wanted the percentage and time left the COO portal's world
 * launch bar already shows). Pure, so it is tested without a page.
 *
 * ⭐ WHAT IS REAL AND WHAT IS ESTIMATED. The STAGE is real: Foundry's start-up hooks say when each one ends.
 *    Inside a stage Foundry reports nothing (except the map's pictures, whose own progress is used when it can be
 *    read), so a stage's share is its elapsed time over its median on past loads of this world.
 * ⛔ NEVER CLAIMS DONE EARLY, AND NEVER PARKS AT 99%. Capped at 95% until `ready`; past 85% of a stage it slows
 *    down instead of stopping, and once a stage runs past its usual length the time left is dropped for "taking
 *    longer than usual". Without history there is no time left at all, only the percentage. This is the same
 *    rule, curve and wording as the portal (FoundryLaunchEstimate and foundry-portal.html in ComeOnOverUno).
 */

/** Foundry's start-up, in order: import to `init`, `init` to `setup`, `setup` to the map, its pictures, drawing. */
export const LOADING_ORDER = ['start', 'init', 'setup', 'textures', 'draw'] as const;

export type LoadingStage = (typeof LOADING_ORDER)[number];

/** Seconds per stage, for those that have any. */
export type StageSeconds = Partial<Record<LoadingStage, number>>;

/** Stage lengths that shape the bar before a world has any history. Never shown as time left. */
const DEFAULT_STAGE_SECONDS: Readonly<Record<LoadingStage, number>> = {
  start: 10,
  init: 30,
  setup: 5,
  textures: 15,
  draw: 10,
};

/** The highest share of a stage, and of the whole bar, before `ready`. */
const STEP_CAP = 0.95;
const MAX_PERCENT = 95;
/** Where a stage stops going straight up and starts to slow. */
const STRAIGHT = 0.85;

/** Where the screen is: the stage, how long it has run, and that stage's real progress when Foundry gives one. */
export interface LoadingMoment {
  readonly stage: LoadingStage;
  readonly elapsedSeconds: number;
  /** 0 to 1, read from Foundry itself (the map's pictures); null when there is none. */
  readonly realShare?: number | null;
}

/** Where the bar should be heading, so it keeps moving while Foundry holds the page and no script can run. */
export interface LoadingGlide {
  readonly fill: number;
  readonly seconds: number;
}

export interface LoadingView {
  /** 1 to 95, what the text says. */
  readonly percent: number;
  /** The same, unrounded, for the bar. */
  readonly fill: number;
  /** Null when there is no honest figure: no history yet, or running long. */
  readonly secondsLeft: number | null;
  /** This stage has run past its usual length. */
  readonly slow: boolean;
  readonly glide: LoadingGlide;
}

/** A stage's share from elapsed over usual length: straight up to 85%, then ever slower towards 95%. */
export function stageShare(fraction: number): number {
  if (fraction <= STRAIGHT) return Math.max(0, fraction);
  return STRAIGHT + (STEP_CAP - STRAIGHT) * (1 - Math.exp(-(fraction - STRAIGHT) / 1.5));
}

/** How far the load has got at `at`, from this world's typical stage lengths (missing ones use the defaults). */
export function estimateLoading(at: LoadingMoment, typical: StageSeconds): LoadingView {
  const length = (stage: LoadingStage): number => typical[stage] ?? DEFAULT_STAGE_SECONDS[stage];
  const index = LOADING_ORDER.indexOf(at.stage);
  const total = LOADING_ORDER.reduce((sum, stage) => sum + length(stage), 0);
  const before = LOADING_ORDER.slice(0, index).reduce((sum, stage) => sum + length(stage), 0);
  const later = LOADING_ORDER.slice(index + 1).reduce((sum, stage) => sum + length(stage), 0);
  const start = (before / total) * 100;
  const width = (length(at.stage) / total) * 100;
  const usual = length(at.stage);
  const elapsed = Math.max(0, at.elapsedSeconds);
  const real = typeof at.realShare === 'number' ? Math.min(1, Math.max(0, at.realShare)) : null;
  const share = real === null ? stageShare(elapsed / usual) : Math.min(STEP_CAP, real);
  const fill = Math.min(MAX_PERCENT, Math.max(1, start + width * share));

  const measured = LOADING_ORDER.slice(index).every((stage) => typical[stage] !== undefined);
  const slow = measured && real === null && elapsed > usual;
  let secondsLeft: number | null = null;
  if (measured && !slow) {
    const inStage = real === null ? usual - elapsed : usual * (1 - real);
    secondsLeft = Math.ceil(Math.max(0, inStage) + later);
  }
  return {
    percent: Math.floor(fill),
    fill,
    secondsLeft,
    slow,
    glide: glideFor(start, width, usual, elapsed),
  };
}

/** Straight on to the stage's 85% mark at the usual pace, or, past it, a slow creep towards its cap. */
function glideFor(start: number, width: number, usual: number, elapsed: number): LoadingGlide {
  if (elapsed < usual * STRAIGHT) {
    return {
      fill: Math.min(MAX_PERCENT, start + width * STRAIGHT),
      seconds: usual * STRAIGHT - elapsed,
    };
  }
  return { fill: Math.min(MAX_PERCENT, start + width * STEP_CAP), seconds: usual * 3 };
}

/** "about 1 min 20 s" from seconds; under a minute in 5s steps, and "a few seconds" at the very end. */
export function timeLeftText(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s <= 5) return 'a few seconds';
  if (s < 55) return `about ${String(Math.ceil(s / 5) * 5)} seconds`;
  const m = Math.floor(s / 60);
  const r = Math.round((s % 60) / 10) * 10;
  if (r === 60) return `about ${String(m + 1)} min`;
  return `about ${String(m)} min${r > 0 ? ` ${String(r)} s` : ''}`;
}

/** "42%, about 1 min left": the percent always, the time left only when there is an honest one. */
export function progressText(view: Pick<LoadingView, 'percent' | 'secondsLeft' | 'slow'>): string {
  const pct = `${String(Math.round(view.percent))}%`;
  if (view.slow) return `${pct}, taking longer than usual`;
  if (view.secondsLeft === null) return pct;
  return `${pct}, ${timeLeftText(view.secondsLeft)} left`;
}
