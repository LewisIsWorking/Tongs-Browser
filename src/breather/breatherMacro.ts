import { automationRole } from '../automation/automationRole.js';
import type { RoleGlobals } from '../automation/automationRole.js';
import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import { BREATHER_TITLE, takeABreatherNoLimit } from './takeABreather.js';
import type { BreatherGlobals, BreatherOutcome } from './takeABreather.js';

/**
 * Putting "Take a Breather (No-Limit Stamina)" in the Macro Directory of every Stamina world. Added 2026-11-02.
 *
 * The "Tongs Macros" compendium ships it too (packs-src/tongs-macros, 2026-11-03), and its command must
 * stay equal to BREATHER_COMMAND. Players also find it where they find a GM's macros: the active full GM's
 * browser makes it once, as a world Script macro every player may run (`ownership.default` 1, LIMITED,
 * which is what PF2e's own "Take a Breather" macro carries). A player drags it to their hotbar.
 *
 * ⚠️ ONCE per world, remembered in a hidden world setting, so a GM who deletes it is not argued with at
 *    every launch. A macro already carrying our flag, or the same name, also counts as made.
 * ⚠️ Only in a world using the Stamina variant: elsewhere it would only say it does nothing.
 * ⚠️ The macro calls the module's API, so it keeps working when Tongs updates, and tells the player when
 *    Tongs is switched off rather than throwing.
 */
const MADE_SETTING = 'breatherMacroMade';
const MACRO_FLAG = 'breatherNoLimit';

export const BREATHER_COMMAND =
  "const tongs = game.modules.get('tongs-browser');\n" +
  'if (tongs?.active && tongs.api?.takeABreatherNoLimit) tongs.api.takeABreatherNoLimit();\n' +
  "else ui.notifications.warn('Take a Breather (No-Limit Stamina) needs the Tongs Browser module switched on.');";

interface MacroLike {
  readonly name?: string;
  getFlag?(scope: string, key: string): unknown;
}

interface MacroClass {
  create?(data: object): Promise<unknown>;
}

interface BreatherSettings {
  register(module: string, key: string, definition: object): void;
  get(module: string, key: string): unknown;
  set(module: string, key: string, value: unknown): Promise<unknown>;
}

export type MacroGlobals = RoleGlobals &
  BreatherGlobals & {
    readonly game?: BreatherGlobals['game'] & {
      readonly macros?: { find?(test: (macro: MacroLike) => boolean): MacroLike | undefined };
    };
    readonly ui?: { readonly notifications?: { info?(message: string): unknown } };
    readonly Macro?: MacroClass & { readonly implementation?: MacroClass };
  };

/**
 * What the module's `api` gains: the macro's one call, beside `TongsBrowser`'s own methods. Takes
 * Foundry's whole `globalThis`, read only as far as `BreatherGlobals` describes it.
 */
export function breatherApi(globals: object): {
  takeABreatherNoLimit(): Promise<BreatherOutcome>;
} {
  return {
    takeABreatherNoLimit: async () => takeABreatherNoLimit(globals),
  };
}

export function registerBreatherSetting(settings: BreatherSettings): void {
  settings.register(MODULE_ID, MADE_SETTING, {
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
  });
}

/** Makes the macro if this browser should, and says what it did; null when it did nothing. */
export async function ensureBreatherMacro(
  settings: BreatherSettings,
  globals: MacroGlobals
): Promise<string | null> {
  const game = globals.game;
  if (
    automationRole(globals) !== 'act' ||
    game?.pf2e?.settings?.variants?.stamina !== true ||
    settings.get(MODULE_ID, MADE_SETTING) === true
  ) {
    return null;
  }
  const existing = game.macros?.find?.(
    (macro) => macro.getFlag?.(MODULE_ID, MACRO_FLAG) === true || macro.name === BREATHER_TITLE
  );
  if (existing === undefined) {
    const macro = globals.Macro?.implementation ?? globals.Macro;
    if (macro?.create === undefined) {
      return null;
    }
    await macro.create({
      name: BREATHER_TITLE,
      type: 'script',
      scope: 'global',
      img: 'icons/svg/unconscious.svg',
      command: BREATHER_COMMAND,
      ownership: { default: 1 },
      flags: { [MODULE_ID]: { [MACRO_FLAG]: true } },
    });
  }
  await settings.set(MODULE_ID, MADE_SETTING, true);
  if (existing !== undefined) {
    return null;
  }
  const told = `Tongs added the macro "${BREATHER_TITLE}" to the Macro Directory. Players can drag it to their hotbar.`;
  globals.ui?.notifications?.info?.(told);
  return told;
}

/** Started at `ready` beside the rest; a failure is logged, never thrown into Foundry's start-up. */
export function startBreatherMacro(settings: BreatherSettings, globals: MacroGlobals): void {
  registerBreatherSetting(settings);
  ensureBreatherMacro(settings, globals).catch((error: unknown) => {
    logger.warn(
      `The breather macro was not made: ${error instanceof Error ? error.message : String(error)}`
    );
  });
}
