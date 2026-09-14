import type { SaveResultFacts, SpellDamageFacts } from './spellDamageFacts.js';
import type { SpellCastFacts } from './spellFacts.js';
import { ATTACK_WINDOW_MS } from './validateStrike.js';

/**
 * Whether a player's basic-save spell damage is safe to apply without the GM, and how. Added 2026-09-14.
 *
 * ⛔ DECIDED WITH LEWIS: the GM's browser applies a basic save's damage by each target's degree of
 * success, when the total fits. That means the damage follows a cast of the same spell at the same rank,
 * just before, with no damage rolled for that cast yet; the spell's save is basic; the formula is PF2e's
 * own for the spell at that rank (measured: rank 5 Vampiric Feast is 10d6, the base spell 6d6); the total
 * is possible; and every recorded target has exactly one save for that cast.
 *
 * Pure: every fact is handed in, so each rule is provable without a Foundry.
 */
export interface CastWithTargets extends SpellCastFacts {
  readonly targets: readonly string[];
}

export interface SpellDamageHistory {
  /** Cast cards posted before the damage, in any order. */
  readonly casts: readonly CastWithTargets[];
  /** Other spell damage cards, in any order. */
  readonly damages: readonly SpellDamageFacts[];
  /** Saving-throw cards, in any order, including ones rolled after the damage. */
  readonly saves: readonly SaveResultFacts[];
}

/**
 * PF2e's own reading of a basic save, as an apply option; a critical success takes nothing.
 *
 * ⚠️ A Map, not an object: `"constructor" in {}` is true, and a save result must never match that.
 */
export const BASIC_SAVE: ReadonlyMap<string, 'half' | 'full' | 'double' | null> = new Map([
  ['criticalSuccess', null],
  ['success', 'half'],
  ['failure', 'full'],
  ['criticalFailure', 'double'],
]);

export interface DamageGroup {
  readonly optionId: 'half' | 'full' | 'double';
  readonly targetTokenUuids: readonly string[];
}

export type SpellDamageVerdict =
  | { readonly kind: 'valid'; readonly targets: readonly string[]; readonly groups: DamageGroup[] }
  /** Everything checks out except that some targets have not rolled their saves yet. */
  | { readonly kind: 'wait'; readonly targets: readonly string[]; readonly reason: string }
  | { readonly kind: 'deck'; readonly reason: string };

/** What PF2e says the spell's damage is at the cast rank, and whether its save is basic. */
export interface SpellDamageRule {
  readonly formula: string | null;
  readonly basic: boolean;
}

const deck = (reason: string): SpellDamageVerdict => ({ kind: 'deck', reason });
const sameSpell = (a: SpellCastFacts | SpellDamageFacts, b: SpellDamageFacts) =>
  a.actorId === b.actorId && a.spellUuid === b.spellUuid;

function checkRoll(damage: SpellDamageFacts, rule: SpellDamageRule | null): string | null {
  if ((rule?.formula ?? null) === null) {
    return "the spell's damage formula could not be worked out";
  }
  if (rule?.basic !== true) {
    return "the spell's save is not a basic save";
  }
  if (damage.formula !== rule.formula) {
    return `the formula ${damage.formula} is not the spell's ${String(rule.formula)}`;
  }
  if (damage.total < damage.min || damage.total > damage.max) {
    return `a total of ${String(damage.total)} is not possible for ${damage.formula}`;
  }
  return null;
}

export function validateSpellDamage(
  damage: SpellDamageFacts,
  history: SpellDamageHistory,
  rule: SpellDamageRule | null
): SpellDamageVerdict {
  const casts = history.casts.filter((each) => sameSpell(each, damage));
  const cast = casts
    .filter((each) => each.timestamp <= damage.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  if (cast === undefined || damage.timestamp - cast.timestamp > ATTACK_WINDOW_MS) {
    return deck('no cast of that spell by that character came just before this damage');
  }
  if (cast.castRank !== damage.castRank) {
    return deck(
      `the damage was rolled at rank ${String(damage.castRank)} but the spell was cast at rank ${String(cast.castRank)}`
    );
  }
  const alreadyDamaged = history.damages.some(
    (each) =>
      each.id !== damage.id &&
      sameSpell(each, damage) &&
      each.timestamp >= cast.timestamp &&
      each.timestamp <= damage.timestamp
  );
  if (alreadyDamaged) {
    return deck('damage was already rolled for that cast');
  }
  const wrongRoll = checkRoll(damage, rule);
  if (wrongRoll !== null) {
    return deck(wrongRoll);
  }
  if (cast.targets.length === 0) {
    return deck('the caster had no targets');
  }

  /* ⚠️ A save belongs to this cast only until the same character casts the same spell again. */
  const next = Math.min(
    ...casts.filter((each) => each.timestamp > cast.timestamp).map((each) => each.timestamp),
    Infinity
  );
  const groups = new Map<DamageGroup['optionId'], string[]>();
  const missing: string[] = [];
  for (const token of cast.targets) {
    const saves = history.saves.filter(
      (each) =>
        each.spellUuid === damage.spellUuid &&
        each.tokenUuid === token &&
        each.timestamp >= cast.timestamp &&
        each.timestamp < next
    );
    const outcome = saves[0]?.outcome;
    if (saves.length > 1) {
      return deck('a target has more than one save for that cast');
    }
    if (outcome === undefined) {
      missing.push(token);
      continue;
    }
    const optionId = BASIC_SAVE.get(outcome);
    if (optionId === undefined) {
      return deck(`a save's result "${outcome}" is not a degree of success`);
    }
    if (optionId !== null) {
      groups.set(optionId, [...(groups.get(optionId) ?? []), token]);
    }
  }
  if (missing.length > 0) {
    return {
      kind: 'wait',
      targets: cast.targets,
      reason: `waiting for ${String(missing.length)} of the spell's targets to roll their save`,
    };
  }
  return {
    kind: 'valid',
    targets: cast.targets,
    groups: [...groups].map(([optionId, targetTokenUuids]) => ({ optionId, targetTokenUuids })),
  };
}
