/**
 * A spell's cast card, read into what automatic saves need. Added 2026-09-14.
 *
 * ⛔ BUILT AGAINST MEASURED CARDS, pf2e 8.5.0, 2026-09-14 (the Feiya iconic's Daze, heightened to rank 3,
 * cast at two Xorns):
 *
 *     cast     flags.pf2e.context.type "spell-cast"; flags.pf2e.origin { uuid: the spell, castRank: 3 }
 *              content  <button data-action="spell-save" data-save="will" data-dc="21">
 *     save     flags.pf2e.context { type: "saving-throw", outcome, target: { token: the saver } }
 *              flags.pf2e.origin.uuid  the SAME spell uuid
 *     damage   flags.pf2e.context { sourceType: "save", target: null, outcome: null }
 *
 * ⛔ NO CARD RECORDS WHO THE SPELL WAS CAST AT. PF2e reads the caster's targets at the moment of casting
 * and keeps none of them. That is why the caster's own browser writes its targets onto the card while
 * it is being created (`TARGETS_FLAG`, decided with Lewis), measured to persist through `toMessage`.
 */
export const TARGETS_FLAG = 'targets';

export interface SpellCastFacts {
  readonly id: string;
  readonly timestamp: number;
  readonly actorId: string;
  readonly spellUuid: string;
}

export interface CastMessage {
  readonly id: string;
  readonly timestamp: number;
  readonly speaker?: { readonly actor?: string | null };
  readonly author?: { readonly id?: string } | null;
  readonly flags?: Readonly<Record<string, unknown>>;
  readonly content?: string;
}

interface CastFlags {
  readonly context?: { readonly type?: string };
  readonly origin?: { readonly uuid?: string; readonly type?: string } | null;
}

export function readSpellCast(message: CastMessage, systemId: string): SpellCastFacts | null {
  const flags = (message.flags?.[systemId] ?? {}) as CastFlags;
  const actorId = message.speaker?.actor;
  const spellUuid = flags.origin?.uuid;
  if (
    flags.context?.type !== 'spell-cast' ||
    typeof actorId !== 'string' ||
    typeof spellUuid !== 'string'
  ) {
    return null;
  }
  return { id: message.id, timestamp: message.timestamp, actorId, spellUuid };
}

/** The tokens the caster had targeted, as the caster's browser recorded them; empty when none. */
export function readRecordedTargets(message: CastMessage, moduleId: string): string[] {
  const targets = (message.flags?.[moduleId] as Record<string, unknown> | undefined)?.[
    TARGETS_FLAG
  ];
  return Array.isArray(targets)
    ? targets.filter((each): each is string => typeof each === 'string')
    : [];
}
