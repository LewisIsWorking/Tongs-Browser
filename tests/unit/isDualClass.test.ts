import { describe, expect, it } from 'vitest';

import { dualClassOf, isDualClass } from '../../src/dualclass/landDualClass.js';
import type { ClassLike } from '../../src/dualclass/landDualClass.js';
import { dualClassSheet } from '../../src/dualclass/dualClassDocuments.js';
import type { DualClassGame } from '../../src/dualclass/dualClassDocuments.js';

/**
 * A dual class, whoever made it: Tongs' flag, or the community macro's roll option or name. 2026-10-20,
 * because players already had macro-made dual classes, which carry no flag of ours.
 */
const cls = (extra: Partial<ClassLike> = {}, flag?: string): ClassLike => ({
  id: 'C',
  type: 'class',
  getFlag: (scope: string, key: string) =>
    scope === 'tongs-browser' && key === 'dualClassFor' ? flag : undefined,
  ...extra,
});
const option = (value: unknown) => ({ key: 'RollOption', domain: 'all', option: value });

describe('telling a dual class', () => {
  it('counts Tongs’ own, by its flag', () => {
    expect(isDualClass(cls({ name: 'Fighter' }, 'r1'))).toBe(true);
  });

  it('counts the macro’s, by a roll option naming another class (b)', () => {
    const fighter = { slug: 'fighter', rules: [option('class:wizard')] };
    expect(isDualClass(cls({ name: 'Fighter', system: fighter }))).toBe(true);
    /* No slug: the item's own is read from its name, as PF2e makes one. */
    expect(isDualClass(cls({ name: 'Fighter', system: { rules: [option('class:wizard')] } }))).toBe(
      true
    );
  });

  it('does not count a roll option for the class itself, or one that is not a class', () => {
    const own = { slug: 'fighter', rules: [option('class:fighter')] };
    expect(isDualClass(cls({ name: 'Fighter', system: own }))).toBe(false);
    const other = {
      slug: 'fighter',
      rules: [
        option('feat:power-attack'),
        option(3),
        { key: 'FlatModifier', option: 'class:x' },
        'x',
      ],
    };
    expect(isDualClass(cls({ name: 'Fighter', system: other }))).toBe(false);
    expect(isDualClass(cls({ name: 'Fighter', system: { slug: 'fighter', rules: 'none' } }))).toBe(
      false
    );
    expect(isDualClass(cls())).toBe(false);
  });

  it('counts the macro’s name, "Class1 - Class2" (c), and not a hyphenated word', () => {
    expect(isDualClass(cls({ name: 'Fighter - Wizard' }))).toBe(true);
    expect(isDualClass(cls({ name: 'Half-Elf Fighter' }))).toBe(false);
  });

  it('only ever counts a class item', () => {
    expect(isDualClass(cls({ type: 'feat', name: 'Fighter - Wizard' }, 'r1'))).toBe(false);
  });

  it('finds the one on a sheet, and leaves the system data as it was', () => {
    const system: Record<string, unknown> = { slug: 'fighter' };
    const plain = cls({ name: 'Fighter', system });
    expect(dualClassOf([plain])).toBeUndefined();
    expect(system).toEqual({ slug: 'fighter' });
    const macro = cls({ id: 'M', name: 'Fighter - Wizard' });
    expect(dualClassOf([plain, macro])).toBe(macro);
  });
});

describe('the GM’s view of the sheet', () => {
  const game = (items?: ClassLike[]): DualClassGame => ({
    user: { isGM: true },
    actors: {
      get: () => ({
        name: 'Kibwe',
        type: 'character',
        ownership: { u1: 3 },
        ...(items === undefined ? {} : { items: { contents: items } }),
      }),
    },
  });

  it('names a dual class already on it, the macro’s included', () => {
    expect(dualClassSheet(game([cls({ name: 'Fighter - Wizard' })]), 'A1', 'u1')).toEqual({
      name: 'Kibwe',
      owned: true,
      dualClass: 'Fighter - Wizard',
    });
    expect(dualClassSheet(game([cls({}, 'r1')]), 'A1', 'u1')?.dualClass).toBe('a dual class');
    expect(dualClassSheet(game([cls({ name: 'Fighter' })]), 'A1', 'u1')).toEqual({
      name: 'Kibwe',
      owned: true,
    });
    expect(dualClassSheet(game(), 'A1', 'u1')).toEqual({ name: 'Kibwe', owned: true });
  });
});
