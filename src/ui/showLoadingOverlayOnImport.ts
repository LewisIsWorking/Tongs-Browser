import { startLoadingOverlay } from './startLoadingOverlay.js';

/**
 * ⏳ Imported first thing by main.ts for its side effect: the loading screen goes up as this module is evaluated,
 * the earliest moment Tongs runs (startLoadingOverlay explains the stages). Kept out of main.ts, which sits at
 * its size limit, and so a test can import startLoadingOverlay without putting a screen up.
 */
startLoadingOverlay({ Hooks, game, document: globalThis.document });
