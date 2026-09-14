import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import type { RollDeck } from '../deck/RollDeck.js';
import { buildAutoApply } from './buildAutoApply.js';
import type { AutoGlobals } from './buildAutoApply.js';
import { SpellDamage } from './SpellDamage.js';
import type { SpellDamagePorts } from './SpellDamage.js';
import type { SpellMessage } from './spellDamageFacts.js';

/**
 * Switching automatic basic-save spell damage on for a world, and connecting it to Foundry. Added
 * 2026-09-14.
 *
 * ⛔ OFF UNTIL A GM TURNS IT ON, per world, and its own setting: rolling enemies' saves and applying the
 * damage are separate decisions, and switching one on must not switch on the other.
 */
export const SPELL_DAMAGE_SETTING = 'autoApplySpellDamage';

interface SettingsLike {
  register(namespace: string, key: string, data: FoundrySettingRegistration): void;
  get(namespace: string, key: string): unknown;
}

interface HooksLike {
  on(name: string, fn: (...args: never[]) => unknown): number;
}

interface SpellItem {
  loadVariant?(options: { castRank: number }): SpellItem | null;
  getDamage?(options: { skipDialog: boolean }): Promise<unknown>;
  readonly system?: { readonly defense?: { readonly save?: { readonly basic?: boolean } | null } };
}

interface SpellActors {
  get?(id: string): { readonly items?: { get?(id: string): SpellItem | undefined } } | undefined;
}

export function registerSpellDamageSetting(settings: SettingsLike): void {
  settings.register(MODULE_ID, SPELL_DAMAGE_SETTING, {
    name: "Auto-apply players' basic-save spell damage",
    hint:
      "When a player's spell with a basic save deals damage to enemies they targeted, and every target " +
      "has rolled its save, the GM's browser applies each one's damage by its degree of success. " +
      'Anything that does not check out waits in the roll deck. Queued until a GM connects.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });
}

/**
 * ⛔ The formula is asked of the spell AT THE CAST RANK. Measured: `getDamage()` on Vampiric Feast gives
 * the base 6d6, `loadVariant({ castRank: 5 }).getDamage()` gives the 10d6 the rank 5 card rolled, and
 * `getDamage` posts no message. Each Foundry method is called on its own object.
 */
export function buildSpellDamagePorts(globals: AutoGlobals, deck: RollDeck): SpellDamagePorts {
  return {
    ...buildAutoApply(globals, deck),
    moduleId: MODULE_ID,
    spellRule: async (spellUuid, castRank) => {
      const ids = /^Actor\.([^.]+)\.Item\.([^.]+)$/.exec(spellUuid);
      try {
        const actors = globals.game?.actors as SpellActors | undefined;
        const spell =
          ids === null ? undefined : actors?.get?.(String(ids[1]))?.items?.get?.(String(ids[2]));
        if (spell === undefined) {
          return null;
        }
        const variant = castRank === null ? spell : (spell.loadVariant?.({ castRank }) ?? spell);
        const damage = (await variant.getDamage?.({ skipDialog: true })) as
          { template?: { damage?: { roll?: { formula?: unknown } } } } | null | undefined;
        const formula = damage?.template?.damage?.roll?.formula;
        return {
          formula: typeof formula === 'string' ? formula : null,
          basic: spell.system?.defense?.save?.basic === true,
        };
      } catch {
        return null;
      }
    },
    applyGroups: async (messageId, groups) => deck.applyGroups(messageId, groups),
  };
}

/** ⚠️ Every hook is registered whatever the setting says, and the setting is read on each event. */
export function startSpellDamage(
  deck: RollDeck,
  hooks: HooksLike,
  settings: SettingsLike,
  globals: AutoGlobals
): SpellDamage {
  const damage = new SpellDamage(buildSpellDamagePorts(globals, deck));
  const run = (work: () => Promise<void>): void => {
    if (settings.get(MODULE_ID, SPELL_DAMAGE_SETTING) === true) {
      work().catch((error: unknown) => {
        logger.warn(
          `Spell damage failed: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    }
  };

  hooks.on('createChatMessage', (message: SpellMessage) => {
    run(async () => damage.onMessageCreated(message));
  });
  hooks.on('canvasReady', () => {
    run(async () => damage.catchUp());
  });
  hooks.on('userConnected', () => {
    run(async () => damage.catchUp());
  });
  run(async () => damage.catchUp());
  return damage;
}
