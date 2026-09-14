import type { StrikeAttackFacts, StrikeDamageFacts } from './strikeFacts.js';

/**
 * Whether a player's strike damage is safe to apply without the GM looking. Added 2026-09-14.
 *
 * ⛔ DECIDED WITH LEWIS: apply automatically only when the same character's attack against the same
 * target, just before, succeeded or crit, AND the total is possible for the weapon's damage formula.
 * Anything else waits in the roll deck for a tap. Why it is needed, measured on pf2e 8.5.0: Foundry
 * accepts a damage card with any total a player writes, a strike's Damage button works with no attack
 * at all, and a MISSED attack's card still rolls damage recorded as "success".
 *
 * Pure: every fact is handed in, so each rule is provable without a Foundry.
 */
export type StrikeVerdict =
  | { readonly kind: 'valid'; readonly attackId: string; readonly targetToken: string }
  | { readonly kind: 'deck'; readonly reason: string };

export interface StrikeHistory {
  /** Attack cards posted before the damage, in any order. */
  readonly attacks: readonly StrikeAttackFacts[];
  /** Other strike damage cards posted before this one. */
  readonly damages: readonly StrikeDamageFacts[];
}

/** How long after its attack a damage roll still counts as that attack's. Play-by-post is slow. */
export const ATTACK_WINDOW_MS = 30 * 60 * 1000;

const HITS: readonly string[] = ['success', 'criticalSuccess'];

const sameStrike = (a: StrikeAttackFacts, b: StrikeAttackFacts) =>
  a.actorId === b.actorId && a.itemUuid === b.itemUuid && a.targetToken === b.targetToken;

const deck = (reason: string): StrikeVerdict => ({ kind: 'deck', reason });

/**
 * ⚠️ The attack is the LATEST matching one before the damage, and it must not already have had damage
 * rolled for it. Otherwise one hit could be followed by two damage rolls, both applied.
 */
function findAttack(damage: StrikeDamageFacts, history: StrikeHistory) {
  const attack = history.attacks
    .filter((each) => sameStrike(each, damage) && each.timestamp <= damage.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  if (attack === undefined || damage.timestamp - attack.timestamp > ATTACK_WINDOW_MS) {
    return null;
  }
  const alreadyDamaged = history.damages.some(
    (each) =>
      each.id !== damage.id &&
      sameStrike(each, damage) &&
      each.timestamp >= attack.timestamp &&
      each.timestamp <= damage.timestamp
  );
  return { attack, alreadyDamaged };
}

export function validateStrike(
  damage: StrikeDamageFacts,
  history: StrikeHistory,
  recomputedFormula: string | null
): StrikeVerdict {
  if (damage.targetToken === null) {
    return deck('the damage roll names no target');
  }
  const found = findAttack(damage, history);
  if (found === null) {
    return deck('no attack by that character on that target came just before this damage');
  }
  const attack = found.attack;
  /* ⚠️ Whether it hit is asked first: after a miss, "it did not hit" is the reason, not "already rolled". */
  if (attack.outcome === null || !HITS.includes(attack.outcome)) {
    return deck(`the attack did not hit (${attack.outcome ?? 'no result'})`);
  }
  if (found.alreadyDamaged) {
    return deck('damage was already rolled for that attack');
  }
  if (damage.outcome !== attack.outcome) {
    return deck(
      `the attack was a ${attack.outcome} but the damage was rolled as ${String(damage.outcome)}`
    );
  }
  if (recomputedFormula === null) {
    return deck("the weapon's damage formula could not be worked out");
  }
  if (damage.formula !== recomputedFormula) {
    return deck(`the formula ${damage.formula} is not the weapon's ${recomputedFormula}`);
  }
  if (damage.total < damage.min || damage.total > damage.max) {
    return deck(`a total of ${String(damage.total)} is not possible for ${damage.formula}`);
  }
  return { kind: 'valid', attackId: attack.id, targetToken: damage.targetToken };
}
