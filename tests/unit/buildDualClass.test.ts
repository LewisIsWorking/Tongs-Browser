import { describe, expect, it } from 'vitest';

import { buildDualClass, dualClassImage } from '../../src/dualclass/buildDualClass.js';
import { classSource, field, fighter, ranger, wizard } from './support/dualClasses.js';

/**
 * The macro's rules, ported: names, attacks, class DC, defenses, description, HP. 2026-10-12.
 * Items, rules and the rest are in `buildDualClassRules.test.ts`.
 */
const IMG = 'systems/pf2e/icons/spells/guidance.webp';
const build = (first = fighter(), second = wizard()) => buildDualClass(first, second, IMG);

describe('the item', () => {
  it('is a class named "1st - 2nd" with the macro picture', () => {
    const item = build();
    expect(item.name).toBe('Fighter - Wizard');
    expect(item.type).toBe('class');
    expect(item.img).toBe(IMG);
  });

  it('puts the picture under the world system', () => {
    expect(dualClassImage('sf2e')).toBe('systems/sf2e/icons/spells/guidance.webp');
    expect(dualClassImage('pf2e')).toBe(IMG);
  });

  it('keeps the 1st class as the base for everything the macro does not merge', () => {
    const item = build(wizard({ classFeatLevels: { value: [2, 4] } }), fighter());
    expect(field(item.system, 'classFeatLevels.value')).toEqual([2, 4]);
    expect(field(item.system, 'slug')).toBe('wizard');
  });

  it('never writes to either compendium class', () => {
    const first = fighter();
    const second = wizard();
    const before = JSON.stringify([first, second]);
    build(first, second);
    expect(JSON.stringify([first, second])).toBe(before);
  });
});

describe('Attacks', () => {
  it('takes the better rank of each kind of weapon', () => {
    const item = build(wizard(), fighter());
    expect(field(item.system, 'attacks')).toMatchObject({
      advanced: 1,
      martial: 2,
      simple: 2,
      unarmed: 2,
    });
  });

  it('takes the 2nd class "other weapons" when it is better than martial and the 1st', () => {
    const other = { name: 'longbow and shortbow', rank: 1 };
    const item = build(wizard(), classSource('Elf', { attacks: { martial: 0, other } }));
    expect(field(item.system, 'attacks.other')).toEqual(other);
  });

  it('merges two "other weapons" lines of the same rank, dropping the first "and "', () => {
    const one = { name: 'whip and sap', rank: 1 };
    const two = { name: 'sap, club', rank: 1 };
    const item = build(
      classSource('A', { attacks: { martial: 0, other: one } }),
      classSource('B', { attacks: { martial: 0, other: two } })
    );
    expect(field(item.system, 'attacks.other')).toEqual({ name: 'whip sap, sap, club', rank: 1 });
  });

  it('drops "other weapons" once martial training covers both classes lines', () => {
    const other = { name: 'longbow', rank: 1 };
    const item = build(classSource('Elf', { attacks: { martial: 0, other } }), fighter());
    expect(field(item.system, 'attacks.other')).toEqual({ name: '', rank: 0 });
  });

  it('keeps the 1st class line when it beats martial training and the 2nd', () => {
    const other = { name: 'firearms', rank: 2 };
    const item = build(classSource('Gunslinger', { attacks: { martial: 1, other } }), wizard());
    expect(field(item.system, 'attacks.other')).toEqual(other);
  });

  it('keeps a better 1st class line when martial training is lower than it', () => {
    const other = { name: 'crossbows', rank: 2 };
    const theirs = { name: 'bombs', rank: 1 };
    const item = build(
      classSource('A', { attacks: { martial: 1, other } }),
      classSource('B', { attacks: { martial: 0, other: theirs } })
    );
    expect(field(item.system, 'attacks.other')).toEqual(other);
  });
});

describe('Class DC, HP and description', () => {
  it('takes the higher class DC and the higher hit points', () => {
    const item = build(wizard({ classDC: 1 }), fighter({ classDC: 2 }));
    expect(field(item.system, 'classDC')).toBe(2);
    expect(field(item.system, 'hp')).toBe(10);
  });

  it('keeps the 1st class values when they are already higher', () => {
    const item = build(fighter({ classDC: 2 }), wizard({ classDC: 1 }));
    expect(field(item.system, 'classDC')).toBe(2);
    expect(field(item.system, 'hp')).toBe(10);
  });

  it('runs the two descriptions together, 1st then 2nd', () => {
    expect(field(build().system, 'description.value')).toBe('<p>Fighter.</p> <p>Wizard.</p>');
  });
});

describe('Defenses', () => {
  it('takes the better rank of each armour', () => {
    expect(field(build(wizard(), fighter()).system, 'defenses')).toEqual({
      heavy: 1,
      light: 1,
      medium: 1,
      unarmored: 1,
    });
  });

  /**
   * ⛔ The macro compared `class2.heavy > dClass.medium`, so a Ranger (heavy 0, medium 1) gave a Wizard
   *    no medium armour. Fixed to compare medium with medium.
   */
  it('gives a Wizard - Ranger the Ranger medium armour', () => {
    expect(field(build(wizard(), ranger()).system, 'defenses.medium')).toBe(1);
  });

  it('never lowers medium armour because the 2nd class has heavy armour', () => {
    const second = classSource('Heavy', { defenses: { heavy: 1, medium: 0 } });
    expect(field(build(fighter(), second).system, 'defenses.medium')).toBe(1);
  });
});

describe('a class missing fields', () => {
  it('reads them as nothing rather than throwing', () => {
    const item = buildDualClass({ name: 'Odd', system: {} }, { name: 'Odder', system: {} }, IMG);
    expect(item.name).toBe('Odd - Odder');
    expect(field(item.system, 'description.value')).toBe(' ');
    expect(field(item.system, 'attacks.other')).toEqual({ name: '', rank: 0 });
  });
});
