import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import { readSaveControlsFromHtml } from '../deck/readSaveControls.js';
import type { RollDeck } from '../deck/RollDeck.js';
import { PENDING_FLAG } from './AutoApply.js';
import { automationRole } from './automationRole.js';
import { buildAutoApply } from './buildAutoApply.js';
import type { AutoGlobals } from './buildAutoApply.js';
import { TARGETS_FLAG } from './spellFacts.js';
import type { CastMessage } from './spellFacts.js';
import { SpellSaves } from './SpellSaves.js';
import type { SpellSavePorts } from './SpellSaves.js';

/**
 * Switching automatic spell saves on for a world, and connecting them to Foundry. Added 2026-09-14.
 *
 * ⛔ OFF UNTIL A GM TURNS IT ON, per world, and separate from strike auto-apply: rolling enemies' saves
 * is its own decision, and switching one on must not switch on the other.
 */
export const SPELL_SAVES_SETTING = 'autoRollSpellSaves';

interface SettingsLike {
  register(namespace: string, key: string, data: FoundrySettingRegistration): void;
  get(namespace: string, key: string): unknown;
}

interface HooksLike {
  on(name: string, fn: (...args: never[]) => unknown): number;
}

/** A message being created, which its author's browser may still add flags to. */
interface Creating extends CastMessage {
  updateSource(changes: object): unknown;
}

export interface SpellGlobals extends AutoGlobals {
  readonly game?: AutoGlobals['game'] & {
    readonly user?: {
      readonly targets?: Iterable<{ readonly document?: { readonly uuid?: string } }>;
    };
  };
}

export function registerSpellSavesSetting(settings: SettingsLike): void {
  settings.register(MODULE_ID, SPELL_SAVES_SETTING, {
    name: "Auto-roll enemies' saves against players' spells",
    hint:
      "When a player casts a spell with a save at enemies they targeted, the GM's browser rolls those " +
      "enemies' saves. Queued until a GM connects. Damage from the spell is still applied by the GM.",
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });
}

/**
 * ⛔ Targets are written onto the caster's card WHILE IT IS BEING CREATED, in the caster's own browser.
 * Measured: flags added in `preCreateChatMessage` persist through PF2e's `toMessage`, so every browser
 * sees the targets the moment it sees the card, with no race against a later update.
 */
export function recordCastTargets(message: Creating, userId: string, globals: SpellGlobals): void {
  const game = globals.game;
  const flags = message.flags?.[game?.system?.id ?? ''] as
    { context?: { type?: string } } | undefined;
  if (userId !== game?.user?.id || flags?.context?.type !== 'spell-cast') {
    return;
  }
  const targets = [...(game.user.targets ?? [])]
    .map((token) => token.document?.uuid)
    .filter((uuid): uuid is string => typeof uuid === 'string');
  if (targets.length === 0) {
    return;
  }
  const queued = automationRole(globals) === 'queue' ? { [PENDING_FLAG]: true } : {};
  message.updateSource({ flags: { [MODULE_ID]: { [TARGETS_FLAG]: targets, ...queued } } });
}

/** The real Foundry behind `SpellSaves`: the strike automation's ports, plus reading and rolling saves. */
export function buildSpellSavePorts(
  globals: SpellGlobals,
  deck: RollDeck,
  doc: Document
): SpellSavePorts {
  return {
    ...buildAutoApply(globals, deck),
    moduleId: MODULE_ID,
    saveControls: (message) => readSaveControlsFromHtml(doc, message.content ?? ''),
    rollSave: async (id, index, tokens) => deck.rollSave(id, index, tokens),
  };
}

export function startSpellSaves(
  deck: RollDeck,
  hooks: HooksLike,
  settings: SettingsLike,
  globals: SpellGlobals,
  doc: Document
): SpellSaves {
  const saves = new SpellSaves(buildSpellSavePorts(globals, deck, doc));
  const on = () => settings.get(MODULE_ID, SPELL_SAVES_SETTING) === true;
  const run = (work: () => Promise<void>): void => {
    if (on()) {
      work().catch((error: unknown) => {
        logger.warn(
          `Spell saves failed: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    }
  };

  hooks.on(
    'preCreateChatMessage',
    (message: Creating, _data: unknown, _options: unknown, userId: string) => {
      if (on()) {
        recordCastTargets(message, userId, globals);
      }
    }
  );
  hooks.on('createChatMessage', (message: CastMessage) => {
    run(async () => saves.onMessageCreated(message));
  });
  hooks.on('canvasReady', () => {
    run(async () => saves.catchUp());
  });
  hooks.on('userConnected', () => {
    run(async () => saves.catchUp());
  });
  run(async () => saves.catchUp());
  return saves;
}
