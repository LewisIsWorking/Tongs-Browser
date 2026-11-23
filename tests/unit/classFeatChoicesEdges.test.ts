import { describe, expect, it } from 'vitest';

import { dualClassSlugs, widenClassFilter } from '../../src/dualclass/classFeatChoices.js';
import type { ClassLike } from '../../src/dualclass/landDualClass.js';
import { startClassFeatChoices, widenedQuery } from '../../src/dualclass/startClassFeatChoices.js';

/**
 * The edges of a dual class's class feat choices (2026-11-23): odd items and filters, an SF2e world, and a
 * PF2e whose ChoiceSet is not what it was. Each must fall back to PF2e's own behaviour, never break.
 */
const CLASS_TRAIT = 'item:trait:{actor|system.details.class.trait}';
const flagged = (extra: Partial<ClassLike>): ClassLike => ({
  id: 'C',
  type: 'class',
  getFlag: (scope: string, key: string) =>
    scope === 'tongs-browser' && key === 'dualClassFor' ? 'r1' : undefined,
  ...extra,
});

describe('odd dual class items', () => {
  it('reads Tongs’ flag, a name with no " - ", and roll options that are not classes', () => {
    const rules = [
      'not a rule',
      { key: 'FlatModifier', option: 'class:x' },
      { key: 'RollOption', option: 7 },
      { key: 'RollOption', option: 'feature:x' },
      { key: 'RollOption', option: 'class:wizard' },
    ];
    expect(
      dualClassSlugs(flagged({ name: 'Fighter', system: { slug: 'fighter', rules } }))
    ).toEqual(['fighter', 'wizard']);
  });

  it('names nothing for a flagged class that only ever names itself, or has no system at all', () => {
    expect(dualClassSlugs(flagged({ name: 'Fighter', system: { slug: 'fighter' } }))).toEqual([]);
    expect(dualClassSlugs(flagged({}))).toEqual([]);
  });
});

describe('odd filters', () => {
  it('keeps numbers, nulls and predicate keys it does not know, widening only class traits', () => {
    const filter = [3, null, { gte: ['self:level', 1] }, { not: CLASS_TRAIT }, [CLASS_TRAIT]];
    expect(widenClassFilter(filter, ['a', 'b'])).toEqual([
      3,
      null,
      { gte: ['self:level', 1] },
      { not: { or: ['item:trait:a', 'item:trait:b'] } },
      [{ or: ['item:trait:a', 'item:trait:b'] }],
    ]);
  });

  it('leaves a query that is not an object, or a sheet with no items, exactly as PF2e made it', () => {
    expect(widenedQuery({ actor: { items: [] } }, 'skills')).toBe('skills');
    const query = { filter: [CLASS_TRAIT] };
    expect(widenedQuery({ actor: {} }, query)).toBe(query);
  });
});

describe('odd systems', () => {
  it('wraps SF2e’s ChoiceSet when the world is Starfinder', () => {
    class ChoiceSet {
      queryCompendium(): unknown[] {
        return [];
      }
    }
    const game = { sf2e: { RuleElements: { builtin: { ChoiceSet } } } };
    expect(startClassFeatChoices({ game })).toBe(true);
  });

  it('wraps nothing when ChoiceSet is not a class, or has no query', () => {
    const world = (ChoiceSet: unknown) => ({
      game: { pf2e: { RuleElements: { builtin: { ChoiceSet } } } },
    });
    expect(startClassFeatChoices(world({ queryCompendium: () => [] }))).toBe(false);
    /* A class from before `queryCompendium` existed: it only knows how to describe itself. */
    class OldChoiceSet {
      readonly key = 'ChoiceSet';
    }
    expect(startClassFeatChoices(world(OldChoiceSet))).toBe(false);
  });
});
