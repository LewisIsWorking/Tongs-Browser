import { LoadingOverlay } from './LoadingOverlay.js';

/**
 * ⏳ Puts LoadingOverlay up the moment Tongs' script is imported, the earliest point a module runs, and moves it
 * through Foundry's start-up hooks until the world is `ready`. Added 2026-10-04 (Lewis: the black screen "doesn't
 * have a loading bar"). The few seconds before any module is imported stay black: Foundry has not run us yet.
 */

/** What this needs from Foundry, so tests can drive it without a running world. */
export interface LoadingOverlayGlobals {
  readonly Hooks: { once(hook: string, fn: () => void): unknown };
  readonly game?:
    { readonly ready?: boolean; readonly world?: { readonly title?: string } } | undefined;
  readonly document?: Document | undefined;
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

  const overlay = new LoadingOverlay(doc);
  overlay.show('Opening Foundry', LOADING_STAGES.start);
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
    overlay.hide();
  });
  setTimeout(() => {
    overlay.hide();
  }, LOADING_GIVE_UP_MS);
  return overlay;
}
