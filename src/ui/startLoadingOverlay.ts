import { LoadingOverlay } from './LoadingOverlay.js';
import { type LoadingStage, type LoadingView, progressText } from './loadingEstimate.js';
import { LoadingHistory, type LoadingStore } from './loadingHistory.js';
import { LoadingProgress } from './LoadingProgress.js';

/**
 * ⏳ Puts LoadingOverlay up the moment Tongs' script is imported, the earliest point a module runs, and moves it
 * through Foundry's start-up hooks until the world is `ready`. Added 2026-10-04 (Lewis: the black screen "doesn't
 * have a loading bar"). The few seconds before any module is imported stay black: Foundry has not run us yet.
 *
 * 📊 2026-11-14: a percentage and time left, "Preparing characters and items: 42%, about 1 min left", worded like
 * the COO portal's world launch. The map stage is split by Foundry's own canvas hooks (`canvasInit` before the
 * pictures load, `canvasDraw` after), and while the pictures load their real progress is read from Foundry's
 * own progress notice. The text refreshes once a second whenever Foundry lets the page run; the bar glides on
 * between (LoadingOverlay). LoadingProgress times the stages and remembers them for this world's next load.
 */

/** What this needs from Foundry, so tests can drive it without a running world. */
export interface LoadingOverlayGlobals {
  readonly Hooks: { once(hook: string, fn: () => void): unknown };
  /**
   * Read when each hook fires, never only at import: until Foundry has fetched the world `game` is a stand-in
   * object (client.mjs: `game: {view}`), which Foundry then REPLACES with the real Game.
   */
  readonly game?:
    | {
        readonly ready?: boolean;
        readonly world?: { readonly id?: string; readonly title?: string };
      }
    | undefined;
  readonly document?: Document | undefined;
}

/** The text for each stage, in order. Exported so a test reads the same words the player does. */
export const LOADING_STAGES = {
  start: 'Loading the world',
  init: 'Preparing characters and items',
  setup: 'Getting the map ready',
} as const;

/** The words for every timed stage: the map's three share one, as a player sees one map getting ready. */
const STAGE_TEXT: Readonly<Record<LoadingStage, string>> = {
  start: LOADING_STAGES.start,
  init: LOADING_STAGES.init,
  setup: LOADING_STAGES.setup,
  textures: LOADING_STAGES.setup,
  draw: LOADING_STAGES.setup,
};

/** Never leave the screen up if Foundry fails before `ready`: after this long it gets out of the way. */
export const LOADING_GIVE_UP_MS = 10 * 60_000;

/** How often the text catches up, whenever Foundry lets the page run. */
export const LOADING_TICK_MS = 1000;

export function startLoadingOverlay(globals: LoadingOverlayGlobals): LoadingOverlay | null {
  const doc = globals.document;
  // Already running (a hot reload), or no page at all (Foundry's server-side tooling): nothing to cover.
  if (!doc || globals.game?.ready === true) return null;

  const overlay = new LoadingOverlay(doc);
  overlay.show('Opening Foundry', LOADING_STAGES.start);
  const progress = new LoadingProgress(new LoadingHistory(() => storageOf(doc)));
  let shown = { percent: 0, fill: 0 };
  const render = (): void => {
    if (progress.done) return;
    const real = progress.current === 'textures' ? foundryPictureProgress(doc) : null;
    const view = progress.view(real);
    shown = {
      percent: Math.max(shown.percent, view.percent),
      fill: Math.max(shown.fill, view.fill),
    };
    const line = `${STAGE_TEXT[progress.current]}: ${progressText({ ...view, percent: shown.percent })}`;
    overlay.setStage(line);
    overlay.setProgress(shown.percent, shown.fill, glideOf(view));
  };
  const worldTitle = (): void => {
    const world = globals.game?.world;
    progress.world(world?.id);
    if (world?.title) overlay.setTitle(`Opening ${world.title}`);
  };
  const enter = (stage: LoadingStage): void => {
    progress.enter(stage);
    render();
  };
  globals.Hooks.once('init', () => {
    worldTitle();
    enter('init');
  });
  globals.Hooks.once('setup', () => {
    worldTitle();
    enter('setup');
  });
  globals.Hooks.once('canvasInit', () => {
    enter('textures');
  });
  globals.Hooks.once('canvasDraw', () => {
    enter('draw');
  });
  const tick = setInterval(render, LOADING_TICK_MS);
  globals.Hooks.once('ready', () => {
    clearInterval(tick);
    progress.finish();
    overlay.setStage('Ready');
    overlay.setProgress(100, 100);
    overlay.hide();
  });
  setTimeout(() => {
    clearInterval(tick);
    progress.abandon();
    overlay.hide();
  }, LOADING_GIVE_UP_MS);
  render();
  return overlay;
}

function glideOf(view: LoadingView): { fill: number; ms: number } {
  return { fill: view.glide.fill, ms: view.glide.seconds * 1000 };
}

/** The page's localStorage, or null where the browser refuses it (reading the property itself can throw). */
function storageOf(doc: Document): LoadingStore | null {
  try {
    return doc.defaultView?.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * The share of the map's pictures loaded so far, 0 to 1, from the progress notice Foundry's TextureLoader puts up
 * while a scene's pictures load (it sets `--pct` on it); null when there is none to read. Read only while the
 * pictures are loading, so another progress notice is not mistaken for it.
 */
function foundryPictureProgress(doc: Document): number | null {
  const notices = doc.querySelectorAll<HTMLElement>('#notifications .notification.progress');
  const notice = notices.item(notices.length - 1) as HTMLElement | null;
  const pct = notice ? Number.parseFloat(notice.style.getPropertyValue('--pct')) : Number.NaN;
  return Number.isFinite(pct) ? Math.min(1, Math.max(0, pct / 100)) : null;
}
