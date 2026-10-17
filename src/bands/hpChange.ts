import { MANUAL_CAUSE } from './bandCause.js';
import type { BandCause } from './bandCause.js';

/**
 * One HP or Stamina change on a player character, for ComeOnOverUno's durable record. Added 2026-10-17.
 *
 * ⭐ LEWIS, 2026-10-17: "Tongs should record all HP and stamina changes, with dates and reasons." In C06 Daichi
 * Kenshin's Stamina fell from 35 to 8 with no record, Foundry's chat log was later cleared, and nobody could say
 * why. So EVERY change is recorded, falls and rises alike: damage, persistent damage, healing, rest, and a GM's
 * edit to the sheet ("manual change").
 *
 * ⛔ PLAYER CHARACTERS ONLY (`type: "character"`), and the reason is the PUBLIC wording: the record is readable
 * by anyone, as a player character's HP is the table's. An attacker players cannot see is never named, and the
 * IWR (which names resistances) is never sent.
 *
 * ⚠️ A "before" is what Tongs remembered. A character first seen mid-change has none, and the record says so
 * rather than guessing.
 *
 * Pure: the actor's pools before and after are handed in.
 */

/** HP and Stamina Points as an actor shows them; `sp` and `maxSp` are null without the Stamina variant. */
export interface Pools {
  readonly hp: number;
  readonly maxHp: number;
  readonly sp: number | null;
  readonly maxSp: number | null;
}

/** What `hp-change` takes. Absent "before" values are unknown, not zero. */
export interface HpChangePost {
  readonly actorId: string;
  readonly name: string;
  readonly hpBefore?: number;
  readonly hpAfter: number;
  readonly maxHp: number;
  readonly spBefore?: number;
  readonly spAfter?: number;
  readonly maxSp?: number;
  readonly reason: string;
  /** When Foundry made the change, ISO 8601 UTC. */
  readonly at: string;
}

interface PoolsActor {
  readonly system?: {
    readonly attributes?: {
      readonly hp?: {
        readonly value?: unknown;
        readonly max?: unknown;
        readonly sp?: { readonly value?: unknown; readonly max?: unknown } | null;
      };
    };
  };
}

/** The pools an actor shows now, or null when it has no readable HP. */
export function poolsOf(actor: unknown): Pools | null {
  const hp = (actor as PoolsActor | null)?.system?.attributes?.hp;
  if (typeof hp?.value !== 'number' || typeof hp.max !== 'number') {
    return null;
  }
  const sp = hp.sp;
  const stamina =
    typeof sp?.value === 'number' && typeof sp.max === 'number' && sp.max > 0
      ? { sp: Math.max(0, sp.value), maxSp: sp.max }
      : { sp: null, maxSp: null };
  return { hp: Math.max(0, hp.value), maxHp: hp.max, ...stamina };
}

/** The change, without its reason, or null when nothing Tongs remembers moved. */
export function readHpChange(
  actorId: string,
  name: string,
  before: Pools | undefined,
  after: Pools,
  at: string
): Omit<HpChangePost, 'reason'> | null {
  if (before?.hp === after.hp && before.sp === after.sp) {
    return null;
  }
  const spBefore = before?.sp ?? null;
  return {
    actorId,
    name,
    ...(before === undefined ? {} : { hpBefore: before.hp }),
    hpAfter: after.hp,
    maxHp: after.maxHp,
    ...(after.sp === null || after.maxSp === null
      ? {}
      : { ...(spBefore === null ? {} : { spBefore }), spAfter: after.sp, maxSp: after.maxSp }),
    at,
  };
}

/**
 * Why, in words anyone may read: "Electrical Bolt from Chamber of Scribing", "healed by Heal from Kyra",
 * "Persistent Electricity" (the character's own condition), or "manual change" when PF2e posted no card.
 */
export function hpChangeReason(cause: BandCause, characterName: string): string {
  if (cause.gm === MANUAL_CAUSE) {
    return MANUAL_CAUSE;
  }
  const healing = cause.gm.startsWith('heal');
  const shown = cause.shown;
  if (shown === null) {
    return healing
      ? 'healing, from a source players cannot see'
      : 'damage, from a source players cannot see';
  }
  /* A condition on the character itself (persistent damage) names the condition, not the character. */
  if (!healing && shown.item !== null && shown.attacker.name === characterName) {
    return shown.item;
  }
  return shown.text;
}
