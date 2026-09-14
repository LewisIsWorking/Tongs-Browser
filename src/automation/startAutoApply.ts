import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import type { RollDeck } from '../deck/RollDeck.js';
import { AutoApply } from './AutoApply.js';
import { buildAutoApply } from './buildAutoApply.js';
import type { AutoGlobals } from './buildAutoApply.js';
import type { StrikeMessage } from './strikeFacts.js';

/**
 * Switching phase 2's auto-apply on for a world, and connecting it to Foundry's hooks. Added
 * 2026-09-14.
 *
 * ⛔ OFF UNTIL A GM TURNS IT ON, per world. The module is installed in a live campaign, and a release
 * must never start applying damage there by surprise. A WORLD setting, unlike every other Tongs setting,
 * because it is a decision about the game rather than about one person's device, and every browser in
 * the world has to agree on it: players' browsers queue, the GM's applies.
 */
export const AUTO_APPLY_SETTING = 'autoApplyStrikes';

interface SettingsLike {
  register(namespace: string, key: string, data: FoundrySettingRegistration): void;
  get(namespace: string, key: string): unknown;
}

interface HooksLike {
  on(name: string, fn: (...args: never[]) => unknown): number;
}

export function registerAutoApplySetting(settings: SettingsLike): void {
  settings.register(MODULE_ID, AUTO_APPLY_SETTING, {
    name: "Auto-apply players' checked strike damage",
    hint:
      "When a player's strike hits an enemy and its damage checks out against the weapon, the GM's " +
      'browser applies it without waiting. Anything that does not check out waits in the roll deck. ' +
      'With no GM connected, hits queue until one connects.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });
}

/**
 * ⚠️ Every hook is registered whatever the setting says, and the setting is read on each event, so
 * turning it on takes effect at once, without a reload, in every browser.
 *
 * ⚠️ Called on `hooks` and `settings` as objects: `Hooks.on` is a static method that reads `this`.
 */
export function startAutoApply(
  deck: RollDeck,
  hooks: HooksLike,
  settings: SettingsLike,
  globals: AutoGlobals
): AutoApply {
  const auto = new AutoApply(buildAutoApply(globals, deck));
  const run = (label: string, work: () => Promise<void>): void => {
    if (settings.get(MODULE_ID, AUTO_APPLY_SETTING) !== true) {
      return;
    }
    work().catch((error: unknown) => {
      logger.warn(
        `Auto-apply ${label} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    });
  };

  hooks.on('createChatMessage', (message: StrikeMessage) => {
    run('on a new message', async () => auto.onMessageCreated(message));
  });
  /* A scene change can bring queued targets into view; a GM connecting or leaving can make this browser the one that acts. */
  hooks.on('canvasReady', () => {
    run('catch-up', async () => auto.catchUp());
  });
  hooks.on('userConnected', () => {
    run('catch-up', async () => auto.catchUp());
  });
  run('catch-up', async () => auto.catchUp());
  return auto;
}
