import { describe, expect, it } from 'vitest';

import { applyImport, describeReport } from '../../src/welcome/applyImport.js';
import type { ImportPorts } from '../../src/welcome/applyImport.js';
import { readImportBuild } from '../../src/welcome/importBuild.js';
import { COO_EXPORT } from './support/cooFoundryExport.js';

/** Filling the sheet from an export, in the player's browser. 2026-10-05. */
const BUILD = readImportBuild(COO_EXPORT)!;

function sheet(
  overrides: Partial<ImportPorts> = {},
  compendium = ['Dwarf', 'Rock Dwarf', 'Acolyte', 'Fighter', 'Sudden Charge']
) {
  const updates: Record<string, unknown>[] = [];
  const created: Record<string, unknown>[] = [];
  const ports: ImportPorts = {
    has: () => false,
    find: async (type, name) =>
      Promise.resolve(compendium.includes(name) ? { name, type, system: { from: 'pf2e' } } : null),
    update: async (data) => Promise.resolve(updates.push(data)),
    createItem: async (data) => Promise.resolve(created.push(data)),
    ...overrides,
  };
  return { ports, updates, created };
}

describe('applying an import', () => {
  it('sets the level and the final modifiers as manual attributes, first', async () => {
    const { ports, updates } = sheet();
    await applyImport(BUILD, ports);
    expect(updates).toEqual([
      {
        'system.details.level.value': 1,
        'system.build.attributes.manual': true,
        'system.abilities': {
          str: { mod: 4 },
          dex: { mod: 1 },
          con: { mod: 2 },
          int: { mod: 0 },
          wis: { mod: 1 },
          cha: { mod: -1 },
        },
        'system.details.keyability.value': 'str',
      },
    ]);
  });

  it("adds PF2e's own documents in order, slots feats, and makes lore from the export", async () => {
    const { ports, created } = sheet();
    const report = await applyImport(BUILD, ports);
    expect(created.map((item) => item['name'])).toEqual([
      'Dwarf',
      'Rock Dwarf',
      'Acolyte',
      'Fighter',
      'Sudden Charge',
      'Scribing Lore',
    ]);
    expect(created[4]).toEqual({
      name: 'Sudden Charge',
      type: 'feat',
      system: { from: 'pf2e', location: 'class-1' },
    });
    expect(created[5]).toEqual({
      name: 'Scribing Lore',
      type: 'lore',
      system: { proficient: { value: 1 } },
    });
    expect(report).toEqual({
      added: ['Dwarf', 'Rock Dwarf', 'Acolyte', 'Fighter', 'Sudden Charge', 'Scribing Lore'],
      missing: ['Dwarven Weapon Familiarity'],
      spells: 1,
    });
  });

  /** ⚠️ A reload part way through runs it again; a class also grants features by itself. */
  it('skips anything already on the sheet, but still counts it as imported', async () => {
    const { ports, created } = sheet({
      has: (_type, name) => name === 'Dwarf' || name === 'Sudden Charge',
    });
    const report = await applyImport(BUILD, ports);
    expect(created.map((item) => item['name'])).not.toContain('Dwarf');
    expect(created.map((item) => item['name'])).not.toContain('Sudden Charge');
    expect(report.added).toEqual(expect.arrayContaining(['Dwarf', 'Sudden Charge']));
  });

  it('counts an item PF2e refused as missing, and carries on', async () => {
    const { ports, created } = sheet({
      createItem: async (data) =>
        data['name'] === 'Rock Dwarf'
          ? Promise.reject(new Error('no'))
          : Promise.resolve(created.push(data)),
    });
    const report = await applyImport(BUILD, ports);
    expect(report.missing).toContain('Rock Dwarf');
    expect(report.added).toContain('Fighter');
  });

  it('leaves attributes alone when the export had none, and leaves unslotted feats unslotted', async () => {
    const bare = readImportBuild({
      items: [{ name: 'Sudden Charge', type: 'feat', system: { category: 'archetype' } }],
    })!;
    const { ports, updates, created } = sheet();
    await applyImport(bare, ports);
    expect(updates).toEqual([{ 'system.details.level.value': 1 }]);
    expect(created[0]).toEqual({ name: 'Sudden Charge', type: 'feat', system: { from: 'pf2e' } });
  });

  it('still slots a feat whose compendium copy has no system data', async () => {
    const { ports, created } = sheet({
      find: async (type, name) => Promise.resolve(name === 'Sudden Charge' ? { name, type } : null),
    });
    await applyImport(BUILD, ports);
    expect(created[0]).toEqual({
      name: 'Sudden Charge',
      type: 'feat',
      system: { location: 'class-1' },
    });
  });
});

describe('the report', () => {
  it('says what came across and what to add by hand', () => {
    expect(describeReport({ added: ['A', 'B'], missing: ['C', 'D'], spells: 3 })).toBe(
      'Imported 2 items. Not found, add by hand: C, D. Add your 3 spells on the Spells tab.'
    );
    expect(describeReport({ added: [], missing: [], spells: 0 })).toBe('Imported 0 items.');
  });
});
