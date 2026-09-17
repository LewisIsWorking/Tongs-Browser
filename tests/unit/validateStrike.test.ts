import { describe, expect, it } from 'vitest';

import type { StrikeAttackFacts, StrikeDamageFacts } from '../../src/automation/strikeFacts.js';
import { ATTACK_WINDOW_MS, validateStrike } from '../../src/automation/validateStrike.js';

/**
 * Whether a player's strike damage may be applied without the GM. Written 2026-09-14.
 *
 * ⛔ Each rule is the decision Lewis made: a matching hit just before, and a total the rolled dice
 * allows. The fixture numbers are the measured Reinforced Stock: `1d8 + 3 bludgeoning`, 4 to 11.
 */
const TARGET = 'Scene.S.Token.X';
const WEAPON = 'Actor.A.Item.W';

const attack = (overrides: Partial<StrikeAttackFacts> = {}): StrikeAttackFacts => ({
  id: 'attack',
  timestamp: 1_000,
  actorId: 'A',
  itemUuid: WEAPON,
  targetToken: TARGET,
  outcome: 'success',
  ...overrides,
});

const damage = (overrides: Partial<StrikeDamageFacts> = {}): StrikeDamageFacts => ({
  ...attack({ id: 'damage', timestamp: 1_088 }),
  authorId: 'player',
  strikeIndex: 1,
  formula: '1d8 + 3 bludgeoning',
  total: 7,
  min: 4,
  max: 11,
  dice: [],
  ...overrides,
});

const history = (attacks: StrikeAttackFacts[] = [attack()], damages: StrikeDamageFacts[] = []) => ({
  attacks,
  damages,
});

describe('a genuine hit', () => {
  it('is valid, naming the attack it belongs to', () => {
    expect(validateStrike(damage(), history())).toEqual({
      kind: 'valid',
      attackId: 'attack',
      targetToken: TARGET,
    });
  });

  it('pairs with the latest matching attack, not an older one', () => {
    const older = attack({ id: 'older', timestamp: 500, outcome: 'failure' });

    expect(validateStrike(damage(), history([older, attack()]))).toMatchObject({
      kind: 'valid',
      attackId: 'attack',
    });
  });

  it('accepts a critical hit with critical damage', () => {
    const crit = attack({ outcome: 'criticalSuccess' });
    const critDamage = damage({
      outcome: 'criticalSuccess',
      formula: '2 * (1d8 + 3) bludgeoning',
      min: 8,
      max: 22,
      total: 20,
    });

    expect(validateStrike(critDamage, history([crit])).kind).toBe('valid');
  });
});

describe('what waits in the roll deck', () => {
  const reason = (...args: Parameters<typeof validateStrike>) => {
    const verdict = validateStrike(...args);
    return verdict.kind === 'deck' ? verdict.reason : 'VALID';
  };

  it('damage that names no target', () => {
    expect(reason(damage({ targetToken: null }), history())).toContain('names no target');
  });

  /** ⛔ Measured: a strike's Damage button works with no attack at all. */
  it('damage with no attack before it', () => {
    expect(reason(damage(), history([]))).toContain('no attack');
  });

  it('an attack by someone else, with another weapon, or at another target', () => {
    for (const other of [
      { actorId: 'B' },
      { itemUuid: 'Actor.A.Item.Other' },
      { targetToken: 'Scene.S.Token.Y' },
    ]) {
      expect(reason(damage(), history([attack(other)]))).toContain('no attack');
    }
  });

  it('an attack posted after the damage', () => {
    expect(reason(damage(), history([attack({ timestamp: 2_000 })]))).toContain('no attack');
  });

  it('an attack too long before it', () => {
    const stale = attack({ timestamp: 1_088 - ATTACK_WINDOW_MS - 1 });

    expect(reason(damage(), history([stale]))).toContain('no attack');
  });

  /** ⛔ Measured: a missed attack's own card still rolls damage, recorded as "success". */
  it('damage after a miss, even though the damage card says success', () => {
    expect(reason(damage(), history([attack({ outcome: 'failure' })]))).toContain('did not hit');
    expect(reason(damage(), history([attack({ outcome: null })]))).toContain('no result');
  });

  /** Found live: damage after a miss that already had damage rolled read "already rolled", not "did not hit". */
  it('names the miss, not the earlier damage, when a missed attack was already rolled for', () => {
    const miss = attack({ outcome: 'failure' });
    const first = damage({ id: 'first', timestamp: 1_050 });

    expect(reason(damage(), history([miss], [first]))).toContain('did not hit');
  });

  it('a second damage roll for the same attack', () => {
    const first = damage({ id: 'first', timestamp: 1_050 });

    expect(reason(damage(), history([attack()], [first]))).toContain('already rolled');
  });

  it('crit damage after a plain hit', () => {
    expect(reason(damage({ outcome: 'criticalSuccess' }), history())).toContain('was a success');
  });

  /*
   * ⛔ Found live 2026-09-17 (Diabla's aimed crit, Zels's pistol): a recomputed formula CANNOT match, because
   * Aim and Sneak Attack depend on the target as it was when the player rolled. PF2e names every die it adds,
   * so the card's own dice are what is checked.
   */
  it('a die PF2e did not add, while its own named dice are fine', () => {
    const aimed = damage({
      formula: '1d6 + 1d4 piercing',
      dice: [
        { slug: 'sneak-attack', label: 'Sneak Attack', diceNumber: 1, enabled: false },
        { slug: 'aim', label: 'Aim', diceNumber: 1, enabled: true },
      ],
    });
    expect(validateStrike(aimed, history())).toMatchObject({ kind: 'valid' });

    const typed = damage({
      dice: [{ slug: 'Wrote It', label: 'Wrote It', diceNumber: 8, enabled: true }],
    });
    expect(reason(typed, history())).toContain('not one PF2e added');
  });

  /*
   * ⛔ THE TWO LIVE CARDS THIS RULE WAS REWRITTEN FOR (Forge, 2026-09-17). Both were declined by the old
   * recomputed-formula rule, which expected an extra 1d6 and no Aim die. Both are legitimate.
   */
  it("applies Lewis's own aimed and sneaking hits", () => {
    const diabla = damage({
      formula: '(2 * (1d4 + 4)) slashing + (2 * 1d4) bludgeoning',
      outcome: 'criticalSuccess',
      total: 24,
      min: 6,
      max: 28,
      dice: [
        { slug: 'sneak-attack', label: 'Sneak Attack', diceNumber: 1, enabled: false },
        { slug: 'aim-damage', label: 'Aim Damage', diceNumber: 1, enabled: true },
      ],
    });
    const zels = damage({
      formula: '1d6 + 1d4 piercing',
      total: 3,
      min: 2,
      max: 10,
      dice: [
        { slug: 'sneak-attack', label: 'Sneak Attack', diceNumber: 1, enabled: false },
        { slug: 'aim', label: 'Aim', diceNumber: 1, enabled: true },
      ],
    });

    expect(validateStrike(diabla, history([attack({ outcome: 'criticalSuccess' })]))).toMatchObject(
      {
        kind: 'valid',
      }
    );
    expect(validateStrike(zels, history())).toMatchObject({ kind: 'valid' });
  });

  /** ⛔ Foundry accepts any total a player writes; the formula's own range is the check. */
  it('a total the formula cannot produce', () => {
    expect(reason(damage({ total: 12 }), history())).toContain('not possible');
    expect(reason(damage({ total: 3 }), history())).toContain('not possible');
  });
});
