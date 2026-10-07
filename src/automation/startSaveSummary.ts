import type { BandGlobals, TokenDocLike } from '../bands/bandTokens.js';
import { nameRules, viewOf } from '../bands/bandTokens.js';
import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import { automationRole } from './automationRole.js';
import type { AutoGlobals } from './buildAutoApply.js';
import { recentStrikeMessages } from './recentStrikeMessages.js';
import { SaveSummary } from './SaveSummary.js';
import type { SaveSummaryPorts } from './SaveSummary.js';
import { popupFor, SUMMARY_FLAG, summaryTarget } from './saveSummaryCard.js';
import type { SpellMessage } from './spellDamageFacts.js';
import { ENEMY_SPELLS_SETTING } from './startSpellDamage.js';
import { SPELL_SAVES_SETTING } from './startSpellSaves.js';

/**
 * The saves card's Foundry side; see `SaveSummary`. Added 2026-10-07.
 *
 * ⚠️ The pop-up is wired in EVERY browser and the card only in the acting GM's: the card is posted by the GM
 * who rolled the saves, and the pop-up belongs to whoever cast the spell.
 */
export interface SummaryGlobals extends AutoGlobals, BandGlobals {
  readonly game?: AutoGlobals['game'] & BandGlobals['game'];
  readonly ChatMessage?: { create?(data: object): Promise<unknown> };
  readonly ui?: { readonly notifications?: { info?(message: string, options?: object): unknown } };
}

interface HooksLike {
  on(name: string, fn: (...args: never[]) => unknown): number;
}

/** A chat message is a Foundry document, which `buildAutoApply`'s narrower view leaves out. */
interface Editable {
  update?(changes: object): Promise<unknown>;
}

interface SettingsLike {
  get(namespace: string, key: string): unknown;
}

export function buildSaveSummaryPorts(globals: SummaryGlobals): SaveSummaryPorts {
  const lookup = (uuid: string): unknown => {
    try {
      return globals.fromUuidSync?.(uuid) ?? null;
    } catch {
      return null;
    }
  };
  const flags = (summary: object) => ({ [MODULE_ID]: { [SUMMARY_FLAG]: summary } });
  return {
    role: () => automationRole(globals),
    systemId: () => globals.game?.system?.id ?? '',
    moduleId: MODULE_ID,
    recentMessages: () => recentStrikeMessages(globals),
    castMessage: (id) => globals.game?.messages?.get?.(id) ?? null,
    spellName: (uuid) => (lookup(uuid) as { name?: string } | null)?.name ?? 'the spell',
    target: (uuid) => {
      const token = lookup(uuid) as TokenDocLike | null;
      return summaryTarget(token === null ? null : viewOf(token, globals), nameRules(globals));
    },
    /* ⛔ Called on the class, never detached: `create` is Foundry's inherited Document.create. */
    post: async (content, summary) => {
      await globals.ChatMessage?.create?.({ content, flags: flags(summary) });
    },
    edit: async (id, content, summary) => {
      const card = globals.game?.messages?.get?.(id) as Editable | undefined;
      await card?.update?.({ content, flags: flags(summary) });
    },
  };
}

export function startSaveSummary(
  hooks: HooksLike,
  settings: SettingsLike,
  globals: SummaryGlobals
): SaveSummary {
  /* The card follows the saves: either side of spell saves on. */
  const on = () =>
    [SPELL_SAVES_SETTING, ENEMY_SPELLS_SETTING].some(
      (key) => settings.get(MODULE_ID, key) === true
    );
  const summary = new SaveSummary(buildSaveSummaryPorts(globals));
  hooks.on('createChatMessage', (message: SpellMessage) => {
    const popup = popupFor(message, MODULE_ID, globals.game?.user?.id ?? null);
    if (popup !== null) {
      globals.ui?.notifications?.info?.(popup, { permanent: true });
    }
    if (on()) {
      summary.onSaveCreated(message).catch((error: unknown) => {
        logger.warn(`Saves card failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
  });
  return summary;
}
