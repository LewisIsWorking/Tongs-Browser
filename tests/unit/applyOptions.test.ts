import { describe, expect, it } from 'vitest';

import { APPLY_OPTIONS, applyLabel, isHealing } from '../../src/deck/applyOptions.js';
import type { ApplyOption } from '../../src/deck/applyOptions.js';

/**
 * The ways a damage card is applied, and what each button says. Written 2026-09-13.
 *
 * ⚠️ A button's words are the only thing a GM on a phone reads before committing: there is no hover to
 * check first. So what a label says is asserted as closely as what the button does.
 */
const option = (id: ApplyOption['id']): ApplyOption => {
  const found = APPLY_OPTIONS.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`No apply option '${id}'.`);
  }
  return found;
};

describe('the options', () => {
  /**
   * ⛔ FIVE, mirroring PF2e 8.5.0's own damage card. The brief listed four and left out TRIPLE, which
   * PF2e's context menu offers; a GM who reaches for it on desktop must find it here too.
   */
  it('offers exactly the five PF2e offers, with its multipliers', () => {
    expect(APPLY_OPTIONS.map((each) => [each.id, each.multiplier])).toEqual([
      ['full', 1],
      ['half', 0.5],
      ['double', 2],
      ['triple', 3],
      ['healing', -1],
    ]);
  });

  /** ⚠️ PF2e keys healing on a negative multiplier (`t < 0`); so must the adapter. */
  it('treats only the negative multiplier as healing', () => {
    expect(APPLY_OPTIONS.filter(isHealing).map((each) => each.id)).toEqual(['healing']);
  });
});

describe('what a damage button says', () => {
  it('names the amount, the type and the target', () => {
    expect(applyLabel(option('full'), 12, ['fire'], 'Goblin Warrior')).toBe(
      'Apply 12 fire to Goblin Warrior'
    );
  });

  /** ⚠️ A non-full option must say which it is, or Half and Apply read identically. */
  it('says which multiplier it is when it is not full', () => {
    expect(applyLabel(option('half'), 6, ['fire'], 'Goblin Warrior')).toBe(
      'Apply 6 fire to Goblin Warrior (half)'
    );
    expect(applyLabel(option('triple'), 36, ['fire'], 'Goblin Warrior')).toBe(
      'Apply 36 fire to Goblin Warrior (triple)'
    );
  });

  /**
   * ⛔ The amount is SHOWN AS GIVEN, never recomputed. PF2e alters each damage instance and rounds each
   * on its own, so the label must print PF2e's figure. Given 7 for a half of 13, it prints 7, not 6.5.
   */
  it('prints the amount it was given rather than working one out', () => {
    expect(applyLabel(option('half'), 7, ['fire'], 'Goblin')).toBe('Apply 7 fire to Goblin (half)');
  });

  it('joins several damage types readably', () => {
    expect(applyLabel(option('full'), 12, ['slashing', 'fire'], 'Goblin')).toBe(
      'Apply 12 slashing and fire to Goblin'
    );
    expect(applyLabel(option('full'), 15, ['slashing', 'fire', 'cold'], 'Goblin')).toBe(
      'Apply 15 slashing, fire and cold to Goblin'
    );
  });

  it('says damage when the roll has no type', () => {
    expect(applyLabel(option('full'), 5, [], 'Goblin')).toBe('Apply 5 damage to Goblin');
  });

  /** ⛔ Decided 2026-09-13: no target means the button asks. It never guesses or uses a selection. */
  it('asks who takes it when the roll recorded no target', () => {
    expect(applyLabel(option('full'), 12, ['fire'], null)).toBe('Choose who takes 12 fire');
  });
});

describe('what a healing button says', () => {
  it('reads as healing, with no damage type', () => {
    expect(applyLabel(option('healing'), 8, ['fire'], 'Lai')).toBe('Heal Lai for 8');
  });

  it('asks who to heal when there is no target', () => {
    expect(applyLabel(option('healing'), 8, [], null)).toBe('Choose who to heal for 8');
  });
});
