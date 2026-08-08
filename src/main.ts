import '../styles/tongs-browser.css';

import { MODULE_ID, MODULE_TITLE } from './constants.js';
import { logger } from './core/Logger.js';

/**
 * Module entry point.
 *
 * Scaffold stage: this registers no behaviour yet. It exists to prove the whole delivery chain
 * works end to end, that the manifest points at the right filenames, that the bundle loads as an
 * ES module inside Foundry, and that the stylesheet is picked up. Features land on later branches.
 */

Hooks.once('init', () => {
  logger.info(`Initialising ${MODULE_TITLE} (${MODULE_ID}).`);
});

Hooks.once('ready', () => {
  logger.info('Ready. No features are registered yet at this stage of development.');
});
