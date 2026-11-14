import { startLoadingOverlay } from './startLoadingOverlay.js';

/**
 * ⏳ Imported first thing by main.ts for its side effect: the loading screen goes up as this module is evaluated,
 * the earliest moment Tongs runs (startLoadingOverlay explains the stages). Kept out of main.ts, which sits at
 * its size limit, and so a test can import startLoadingOverlay without putting a screen up.
 *
 * `game` is a getter, read when each hook fires (2026-11-14): at import it is Foundry's stand-in object, which
 * Foundry replaces with the real Game, so a `game` captured here never had a world and the screen never showed
 * the world's name.
 */
startLoadingOverlay({
  Hooks,
  get game() {
    return game;
  },
  document: globalThis.document,
});
