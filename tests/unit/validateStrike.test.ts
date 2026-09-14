import { describe, expect, it } from 'vitest';

import type { StrikeAttackFacts, StrikeDamageFacts } from '../../src/automation/strikeFacts.js';
import { ATTACK_WINDOW_MS, validateStrike } from '../../src/automation/validateStrike.js';

/**
 * Whether a player's strike damage may be applied without the GM. Written 2026-09-14.
 *
 * ⛔ Each rule is the decision Lewis made: a matching hit just before, and a total the weapon's formula
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
  ...overrides,
});

const history = (attacks: StrikeAttackFacts[] = [attack()], damages: StrikeDamageFacts[] = []) => ({
  attacks,
  damages,
});

const FORMULA = '1d8 + 3 bludgeoning';

describe('a genuine hit', () => {
  it('is valid, naming the attack it belongs to', () => {
    expect(validateStrike(damage(), history(), FORMULA)).toEqual({
      kind: 'valid',
      attackId: 'attack',
    });
  });

  it('pairs with the latest matching attack, not an older one', () => {
    const older = attack({ id: 'older', timestamp: 500, outcome: 'failure' });

    expect(validateStrike(damage(), history([older, attack()]), FORMULA)).toEqual({
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

    expect(validateStrike(critDamage, history([crit]), '2 * (1d8 + 3) bludgeoning').kind).toBe(
      'valid'
    );
  });
});

describe('what waits in the roll deck', () => {
  const reason = (...args: Parameters<typeof validateStrike>) => {
    const verdict = validateStrike(...args);
    return verdict.kind === 'deck' ? verdict.reason : 'VALID';
  };

  it('damage that names no target', () => {
    expect(reason(damage({ targetToken: null }), history(), FORMULA)).toContain('names no target');
  });

  /** ⛔ Measured: a strike's Damage button works with no attack at all. */
  it('damage with no attack before it', () => {
    expect(reason(damage(), history([]), FORMULA)).toContain('no attack');
  });

  it('an attack by someone else, with another weapon, or at another target', () => {
    for (const other of [
      { actorId: 'B' },
      { itemUuid: 'Actor.A.Item.Other' },
      { targetToken: 'Scene.S.Token.Y' },
    ]) {
      expect(reason(damage(), history([attack(other)]), FORMULA)).toContain('no attack');
    }
  });

  it('an attack posted after the damage', () => {
    expect(reason(damage(), history([attack({ timestamp: 2_000 })]), FORMULA)).toContain(
      'no attack'
    );
  });

  it('an attack too long before it', () => {
    const stale = attack({ timestamp: 1_088 - ATTACK_WINDOW_MS - 1 });

    expect(reason(damage(), history([stale]), FORMULA)).toContain('no attack');
  });

  /** ⛔ Measured: a missed attack's own card still rolls damage, recorded as "success". */
  it('damage after a miss, even though the damage card says success', () => {
    expect(reason(damage(), history([attack({ outcome: 'failure' })]), FORMULA)).toContain(
      'did not hit'
    );
    expect(reason(damage(), history([attack({ outcome: null })]), FORMULA)).toContain('no result');
  });

  it('a second damage roll for the same attack', () => {
    const first = damage({ id: 'first', timestamp: 1_050 });

    expect(reason(damage(), history([attack()], [first]), FORMULA)).toContain('already rolled');
  });

  it('crit damage after a plain hit', () => {
    expect(reason(damage({ outcome: 'criticalSuccess' }), history(), FORMULA)).toContain(
      'was a success'
    );
  });

  it("a formula that is not the weapon's, or one that could not be worked out", () => {
    expect(reason(damage({ formula: '9d12 bludgeoning' }), history(), FORMULA)).toContain(
      'is not the weapon'
    );
    expect(reason(damage(), history(), null)).toContain('could not be worked out');
  });

  /** ⛔ Foundry accepts any total a player writes; the formula's own range is the check. */
  it('a total the formula cannot produce', () => {
    expect(reason(damage({ total: 12 }), history(), FORMULA)).toContain('not possible');
    expect(reason(damage({ total: 3 }), history(), FORMULA)).toContain('not possible');
  });
});
