import '../styles/tongs-browser.css';

import { TongsBrowser } from './TongsBrowser.js';
import { MODULE_ID, MODULE_TITLE } from './constants.js';
import { logger } from './core/Logger.js';

/**
 * Module entry point.
 *
 * Construction waits for the ready hook rather than init, because the pointer needs the viewport
 * dimensions and the canvas needs to exist. At init time neither is settled.
 *
 * Settings are not registered yet, so the gesture layer runs on its defaults for now. The settings
 * branch replaces those with per client configuration.
 */

let instance: TongsBrowser | null = null;

Hooks.once('init', () => {
  logger.info(`Initialising ${MODULE_TITLE} (${MODULE_ID}).`);
});

Hooks.once('ready', () => {
  instance = new TongsBrowser({ document, window });
  instance.enable();

  // Exposed on the module entry so other modules and the console can reach it. Foundry's convention
  // for module APIs, and the hook for the scene control toggle that lands with the settings branch.
  const moduleEntry = game?.modules.get(MODULE_ID);
  if (moduleEntry !== undefined) {
    moduleEntry.api = instance;
  }

  logger.info('Ready.');
});
