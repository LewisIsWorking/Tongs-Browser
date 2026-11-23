import { describe, expect, it } from 'vitest';

import { dualClassSlugs, widenClassFilter } from '../../src/dualclass/classFeatChoices.js';
import type { ClassLike } from '../../src/dualclass/landDualClass.js';
import { startClassFeatChoices, widenedQuery } from '../../src/dualclass/startClassFeatChoices.js';
import type { ChoiceSetLike } from '../../src/dualclass/startClassFeatChoices.js';

/**
 * A dual class's class feat questions offer both classes. 2026-11-23: a Thaumaturge - Cleric's Natural
 * Ambition listed only thaumaturge feats, when the player wanted the cleric's Healing Hands.
 */
const CLASS_TRAIT = 'item:trait:{actor|system.details.class.trait}';
/** Natural Ambition's own filter, as PF2e ships it (packs/pf2e/feats/ancestry/human/level-1), shortened. */
const naturalAmbition = () => [
  'item:level:1',
  'item:category:class',
  CLASS_TRAIT,
  { or: ['feature:dragon-instinct', { not: 'item:draconic-arrogance' }] },
];
const both = { or: ['item:trait:thaumaturge', 'item:trait:cleric'] };

const option = (value: string) => ({ key: 'RollOption', domain: 'all', option: value });
const tongsDual = (): ClassLike => ({
  id: 'C',
  type: 'class',
  name: 'Thaumaturge - Cleric',
  system: { slug: 'thaumaturge', rules: [option('class:cleric')] },
});
const plain = (): ClassLike => ({
  id: 'P',
  type: 'class',
  name: 'Thaumaturge',
  system: { slug: 'thaumaturge' },
});

describe('which classes a dual class counts as', () => {
  it('names both, from its slug, its roll option and its name, each once', () => {
    expect(dualClassSlugs(tongsDual())).toEqual(['thaumaturge', 'cleric']);
  });

  it('reads the first class from the name when the item has no slug, never "thaumaturge-cleric"', () => {
    const noSlug = { ...tongsDual(), system: { rules: [option('class:cleric')] } };
    expect(dualClassSlugs(noSlug)).toEqual(['thaumaturge', 'cleric']);
  });

  it('names nothing for a single class', () => {
    expect(dualClassSlugs(plain())).toEqual([]);
  });
});

describe('widening a ChoiceSet filter', () => {
  it("turns Natural Ambition's class trait into either class, and leaves the rest alone", () => {
    const [level, category, , dragon] = naturalAmbition();
    expect(widenClassFilter(naturalAmbition(), ['thaumaturge', 'cleric'])).toEqual([
      level,
      category,
      both,
      dragon,
    ]);
  });

  it('widens a class trait inside a nested statement too', () => {
    const nested = [{ and: ['item:level:1', CLASS_TRAIT] }];
    expect(widenClassFilter(nested, ['thaumaturge', 'cleric'])).toEqual([
      { and: ['item:level:1', both] },
    ]);
  });

  it('gives nothing back when there is no class trait, one class, or no filter at all', () => {
    expect(widenClassFilter(['item:level:1', 'item:trait:general'], ['a', 'b'])).toBeUndefined();
    expect(widenClassFilter(naturalAmbition(), ['thaumaturge'])).toBeUndefined();
    expect(widenClassFilter(undefined, ['a', 'b'])).toBeUndefined();
  });
});

describe('the query PF2e runs', () => {
  const rule = (classItem: ClassLike): ChoiceSetLike => ({
    actor: { items: [{ id: 'F', type: 'feat' }, classItem] },
  });

  it('gets both classes on a dual class sheet, as a copy', () => {
    const query = { filter: naturalAmbition(), itemType: 'feat' };
    const widened = widenedQuery(rule(tongsDual()), query) as {
      filter: unknown[];
      itemType: string;
    };
    expect(widened.filter[2]).toEqual(both);
    expect(widened.itemType).toBe('feat');
    expect(query.filter[2]).toBe(CLASS_TRAIT);
  });

  it("is PF2e's own object on a sheet with one class, or with no sheet", () => {
    const query = { filter: naturalAmbition() };
    expect(widenedQuery(rule(plain()), query)).toBe(query);
    expect(widenedQuery({ actor: null }, query)).toBe(query);
  });

  it("falls back to PF2e's own query if reading the sheet throws", () => {
    const query = { filter: naturalAmbition() };
    const broken = {
      actor: {
        get items(): Iterable<ClassLike> {
          throw new Error('renamed');
        },
      },
    };
    expect(widenedQuery(broken, query)).toBe(query);
  });
});

describe('wrapping PF2e', () => {
  const fakePf2e = () => {
    const seen: unknown[] = [];
    class ChoiceSet {
      actor = { items: [tongsDual()] };
      queryCompendium(choices: { filter: unknown[] }, rollOptions: Set<string>): unknown[] {
        seen.push(choices.filter, rollOptions);
        return [];
      }
    }
    return { seen, ChoiceSet, game: { pf2e: { RuleElements: { builtin: { ChoiceSet } } } } };
  };

  it('widens the query once, however many times it starts, and passes the rest on', () => {
    const { seen, ChoiceSet, game } = fakePf2e();
    expect(startClassFeatChoices({ game })).toBe(true);
    expect(startClassFeatChoices({ game })).toBe(true);
    const options = new Set(['self:level:1']);
    new ChoiceSet().queryCompendium({ filter: naturalAmbition() }, options);
    expect(seen).toEqual([[...naturalAmbition().slice(0, 2), both, naturalAmbition()[3]], options]);
  });

  it('wraps nothing when PF2e has no ChoiceSet query', () => {
    expect(startClassFeatChoices({})).toBe(false);
    expect(startClassFeatChoices({ game: { pf2e: { RuleElements: { builtin: {} } } } })).toBe(
      false
    );
  });
});
