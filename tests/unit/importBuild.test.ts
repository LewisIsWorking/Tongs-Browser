import { describe, expect, it } from 'vitest';

import { describeImport, readImportBuild, storedImport } from '../../src/welcome/importBuild.js';
import { COO_EXPORT } from './support/cooFoundryExport.js';

/** Reading a ComeOnOverUno export, which a player's file supplies. 2026-10-05. */
describe('reading an export', () => {
  const build = readImportBuild(COO_EXPORT);

  it('reads the name, level, final modifiers and key attribute', () => {
    expect(build).toMatchObject({
      name: 'Theo Ironhand',
      level: 1,
      attributes: { str: 4, dex: 1, con: 2, int: 0, wis: 1, cha: -1 },
      keyAttribute: 'str',
    });
  });

  it('reads each item by type and name, with feat levels and categories and lore ranks', () => {
    expect(build?.items).toEqual([
      { type: 'ancestry', name: 'Dwarf', level: 1, category: null },
      { type: 'heritage', name: 'Rock Dwarf', level: 1, category: null },
      { type: 'background', name: 'Acolyte', level: 1, category: null },
      { type: 'class', name: 'Fighter', level: 1, category: null },
      { type: 'feat', name: 'Dwarven Weapon Familiarity', level: 1, category: 'ancestry' },
      { type: 'feat', name: 'Sudden Charge', level: 1, category: 'class' },
      { type: 'lore', name: 'Scribing Lore', level: 1, category: null },
      { type: 'spell', name: 'Shield', level: 0, category: null },
    ]);
  });

  it('says what it read in a few words', () => {
    expect(describeImport(build!)).toBe('Level 1 Dwarf Fighter');
  });

  it('reads its own stored copy back to the same build', () => {
    expect(readImportBuild(JSON.parse(JSON.stringify(storedImport(build!))))).toEqual(build);
  });
});

describe('an untrusted file', () => {
  it.each([null, 'text', [], {}, { items: 'x' }, { type: 'npc', items: [] }])(
    'reads %j as no character',
    (raw) => {
      expect(readImportBuild(raw)).toBeNull();
    }
  );

  it('keeps only known item types, and drops nameless items', () => {
    const build = readImportBuild({
      items: [
        { name: 'Bomb', type: 'weapon' },
        { name: '', type: 'feat' },
        { name: 'Toughness', type: 'feat', system: { category: 'weird' } },
      ],
    });
    expect(build?.items).toEqual([{ type: 'feat', name: 'Toughness', level: 1, category: null }]);
  });

  it('clamps numbers and cuts long text', () => {
    const build = readImportBuild({
      name: 'x'.repeat(500),
      system: {
        details: { level: { value: 99 } },
        abilities: {
          str: { mod: 99 },
          dex: { mod: -99 },
          con: {},
          int: {},
          wis: {},
          cha: { mod: 'x' },
        },
      },
      items: [{ name: 'Lore', type: 'lore', system: { proficient: { value: 9 } } }],
    });
    expect(build?.name).toHaveLength(100);
    expect(build?.level).toBe(20);
    expect(build?.attributes).toEqual({ str: 10, dex: -5, con: 0, int: 0, wis: 0, cha: 0 });
    expect(build?.items[0]?.level).toBe(4);
  });

  it('has no attributes or key attribute when the export lacks them', () => {
    const build = readImportBuild({
      items: [],
      system: { abilities: { str: { mod: 1 } }, details: { keyability: { value: 'luck' } } },
    });
    expect(build?.attributes).toBeNull();
    expect(build?.keyAttribute).toBeNull();
    expect(describeImport(build!)).toBe('Level 1');
    expect(readImportBuild(storedImport(build!))).toEqual(build);
  });
});
