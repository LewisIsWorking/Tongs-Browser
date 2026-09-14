import type { CastMessage } from './spellFacts.js';

/**
 * A spell's damage card and its targets' saving-throw cards, read into facts. Added 2026-09-14.
 *
 * ⛔ BUILT AGAINST MEASURED CARDS, pf2e 8.5.0, 2026-09-14 (the Feiya iconic's Vampiric Feast cast at
 * rank 5 at two Xorns, and Daze at rank 3):
 *
 *     damage   flags.pf2e.context { type: "damage-roll", sourceType: "save", target: null, outcome: null }
 *              flags.pf2e.origin { uuid: the spell, castRank: 5 }     speaker.actor  the caster
 *              rolls[0]  formula "10d6 void", total, minimumValue 10, maximumValue 60
 *     save     flags.pf2e.context { type: "saving-throw", outcome, isReroll,
 *                                   target: { token: "Scene.S.Token.T" } }
 *              flags.pf2e.origin { uuid: the SAME spell, castRank: 5 }
 *
 * ⚠️ The damage card names no target and no outcome. Who takes it, and how much, comes only from the
 * cast card's recorded targets and each target's own save.
 *
 * ⚠️ A rerolled save DELETES the old card and posts a new one with `isReroll: true` (measured), so a
 * target normally has exactly one save card per cast.
 */
export interface SpellMessage extends CastMessage {
  readonly isDamageRoll?: boolean;
  readonly rolls?: readonly {
    readonly formula?: string;
    readonly total?: number;
    readonly minimumValue?: number;
    readonly maximumValue?: number;
  }[];
}

export interface SpellDamageFacts {
  readonly id: string;
  readonly timestamp: number;
  readonly actorId: string;
  readonly authorId: string | null;
  readonly spellUuid: string;
  readonly castRank: number | null;
  readonly formula: string;
  readonly total: number;
  readonly min: number;
  readonly max: number;
}

export interface SaveResultFacts {
  readonly id: string;
  readonly timestamp: number;
  readonly spellUuid: string;
  readonly tokenUuid: string;
  readonly outcome: string;
}

interface Flags {
  readonly context?: {
    readonly type?: string;
    readonly sourceType?: string;
    readonly outcome?: string | null;
    readonly target?: { readonly token?: string } | null;
  };
  readonly origin?: { readonly uuid?: string; readonly castRank?: number } | null;
}

const flagsOf = (message: SpellMessage, systemId: string) =>
  (message.flags?.[systemId] ?? {}) as Flags;

export function readSpellDamage(message: SpellMessage, systemId: string): SpellDamageFacts | null {
  const flags = flagsOf(message, systemId);
  const roll = message.rolls?.[0];
  const actorId = message.speaker?.actor;
  const spellUuid = flags.origin?.uuid;
  if (
    message.isDamageRoll !== true ||
    flags.context?.type !== 'damage-roll' ||
    flags.context.sourceType !== 'save' ||
    typeof actorId !== 'string' ||
    typeof spellUuid !== 'string' ||
    typeof roll?.formula !== 'string' ||
    typeof roll.total !== 'number' ||
    typeof roll.minimumValue !== 'number' ||
    typeof roll.maximumValue !== 'number'
  ) {
    return null;
  }
  return {
    id: message.id,
    timestamp: message.timestamp,
    actorId,
    authorId: message.author?.id ?? null,
    spellUuid,
    castRank: typeof flags.origin?.castRank === 'number' ? flags.origin.castRank : null,
    formula: roll.formula,
    total: roll.total,
    min: roll.minimumValue,
    max: roll.maximumValue,
  };
}

export function readSaveResult(message: SpellMessage, systemId: string): SaveResultFacts | null {
  const flags = flagsOf(message, systemId);
  const spellUuid = flags.origin?.uuid;
  const tokenUuid = flags.context?.target?.token;
  const outcome = flags.context?.outcome;
  if (
    flags.context?.type !== 'saving-throw' ||
    typeof spellUuid !== 'string' ||
    typeof tokenUuid !== 'string' ||
    typeof outcome !== 'string'
  ) {
    return null;
  }
  return { id: message.id, timestamp: message.timestamp, spellUuid, tokenUuid, outcome };
}
