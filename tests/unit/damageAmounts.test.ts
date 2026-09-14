import { describe, expect, it } from 'vitest';

import { damageAmounts } from '../../src/deck/damageAmounts.js';

/**
 * What each apply button would send, asked of PF2e. Written 2026-09-14.
 *
 * ⛔ The fake `alter` reads `this`, as PF2e's does, so a detached call fails here rather than in a game.
 */
const measuredJaws = {
  total: 6,
  /* Measured 2026-09-13: 5 piercing and 1 fire, altered instance by instance and each rounded down. */
  byMultiplier: new Map([
    [0.5, 2],
    [2, 12],
    [3, 18],
  ]),
  alter(this: { byMultiplier: Map<number, number> }, multiplier: number, addend: number) {
    return { total: (this.byMultiplier.get(multiplier) ?? Number.NaN) + addend };
  },
};

describe('pricing each option', () => {
  it("uses PF2e's altered totals, not the total multiplied", () => {
    expect(damageAmounts(measuredJaws)).toEqual({
      full: 6,
      half: 2,
      double: 12,
      triple: 18,
      healing: 6,
    });
  });
});

describe('an option PF2e cannot price', () => {
  it('is left out when the roll cannot alter', () => {
    expect(damageAmounts({ total: 9 })).toEqual({ full: 9, healing: 9 });
  });

  it('is left out when alter throws', () => {
    const broken = {
      total: 9,
      alter: () => {
        throw new Error('not evaluated');
      },
    };

    expect(damageAmounts(broken)).toEqual({ full: 9, healing: 9 });
  });

  it('is left out when alter returns no number', () => {
    expect(damageAmounts({ total: 9, alter: () => ({}) })).toEqual({ full: 9, healing: 9 });
    expect(damageAmounts({ total: 9, alter: () => ({ total: Number.NaN }) })).toEqual({
      full: 9,
      healing: 9,
    });
  });

  it('reads a missing total as zero', () => {
    expect(damageAmounts({})).toEqual({ full: 0, healing: 0 });
  });
});
