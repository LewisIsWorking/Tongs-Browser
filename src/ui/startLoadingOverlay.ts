import { LoadingOverlay } from './LoadingOverlay.js';
import { expectedLoadMs, rememberLoadMs } from './loadingTimes.js';

/**
 * ⏳ Puts LoadingOverlay up the moment Tongs' script is imported, the earliest point a module runs, and moves it
 * through Foundry's start-up hooks until the world is `ready`. Added 2026-10-04 (Lewis: the black screen "doesn't
 * have a loading bar"). The few seconds before any module is imported stay black: Foundry has not run us yet.
 */

/** What this needs from Foundry, so tests can drive it without a running world. */
export interface LoadingOverlayGlobals {
  readonly Hooks: { once(hook: string, fn: () => void): unknown };
  readonly game?:
    | {
        readonly ready?: boolean;
        readonly world?: { readonly id?: string; readonly title?: string };
      }
    | undefined;
  readonly document?: Document | undefined;
  /** Where the last load's time is kept (2026-11-08); none means the sliding bar, as before. */
  readonly storage?: Storage | undefined;
  /** The clock, for tests; performance.now() otherwise. */
  readonly now?: (() => number) | undefined;
}

/** The text for each stage, in order. Exported so a test reads the same words the player does. */
export const LOADING_STAGES = {
  start: 'Loading the world',
  init: 'Preparing characters and items',
  setup: 'Getting the map ready',
} as const;

/** Never leave the screen up if Foundry fails before `ready`: after this long it gets out of the way. */
export const LOADING_GIVE_UP_MS = 10 * 60_000;

export function startLoadingOverlay(globals: LoadingOverlayGlobals): LoadingOverlay | null {
  const doc = globals.document;
  // Already running (a hot reload), or no page at all (Foundry's server-side tooling): nothing to cover.
  if (!doc || globals.game?.ready === true) return null;

  const now = globals.now ?? ((): number => performance.now());
  const startedAt = now();
  const overlay = new LoadingOverlay(doc);
  // ⏱️ 2026-11-08: fill the bar over the last load's time. The world is not known yet this early, so the most
  //    recent load stands in; it is the same world on almost every reload.
  overlay.show(
    'Opening Foundry',
    LOADING_STAGES.start,
    expectedLoadMs(globals.storage, globals.game?.world?.id)
  );
  const worldTitle = (): void => {
    const title = globals.game?.world?.title;
    if (title) overlay.setTitle(`Opening ${title}`);
  };
  globals.Hooks.once('init', () => {
    worldTitle();
    overlay.setStage(LOADING_STAGES.init);
  });
  globals.Hooks.once('setup', () => {
    worldTitle();
    overlay.setStage(LOADING_STAGES.setup);
  });
  globals.Hooks.once('ready', () => {
    rememberLoadMs(globals.storage, now() - startedAt, globals.game?.world?.id);
    overlay.hide();
  });
  setTimeout(() => {
    overlay.hide();
  }, LOADING_GIVE_UP_MS);
  return overlay;
}
