import { describe, expect, it } from 'vitest';

import { classChoices, variantOff } from '../../src/dualclass/classChoices.js';
import type { ChoiceGame } from '../../src/dualclass/classChoices.js';

/** The classes the window offers, and the variant rule note. 2026-10-12. */
const entry = (pack: string, id: string, name: string, type = 'class') => ({
  _id: id,
  name,
  type,
  uuid: `Compendium.${pack}.Item.${id}`,
});

function packs(contents: Record<string, { label?: string; entries: unknown[] }>): ChoiceGame {
  return {
    packs: {
      get: (key) => {
        const pack = contents[key];
        return pack === undefined
          ? undefined
          : {
              ...(pack.label === undefined ? {} : { metadata: { label: pack.label } }),
              getIndex: async () =>
                Promise.resolve(new Map(pack.entries.map((each, i) => [i, each]))),
            };
      },
    },
  };
}

describe('the classes offered', () => {
  it('lists every class in the listed compendiums this world has, by name', async () => {
    const game = packs({
      'pf2e.classes': {
        entries: [entry('pf2e.classes', 'W', 'Wizard'), entry('pf2e.classes', 'F', 'Fighter')],
      },
      'battlezoo-eldamon-pf2e.classes': {
        entries: [entry('battlezoo-eldamon-pf2e.classes', 'E', 'Eldamon Trainer')],
      },
      'world.homebrew': { entries: [entry('world.homebrew', 'H', 'Homebrewer')] },
    });
    expect(await classChoices(game)).toEqual([
      { uuid: 'Compendium.battlezoo-eldamon-pf2e.classes.Item.E', name: 'Eldamon Trainer' },
      { uuid: 'Compendium.pf2e.classes.Item.F', name: 'Fighter' },
      { uuid: 'Compendium.pf2e.classes.Item.W', name: 'Wizard' },
    ]);
  });

  it('leaves out anything that is not a class, rather than refusing them all as the macro did', async () => {
    const game = packs({
      'pf2e.classes': {
        entries: [
          entry('pf2e.classes', 'F', 'Fighter'),
          entry('pf2e.classes', 'X', 'Power Attack', 'feat'),
          { type: 'class', name: 'No UUID' },
          { type: 'class', uuid: 'Compendium.pf2e.classes.Item.N' },
        ],
      },
    });
    expect(await classChoices(game)).toEqual([
      { uuid: 'Compendium.pf2e.classes.Item.F', name: 'Fighter' },
    ]);
  });

  it('tells apart two classes of one name by their compendium', async () => {
    const playtest = 'pf2e-playtest-data.battlecry-playtest-classes';
    const game = packs({
      'pf2e.classes': { label: 'Classes', entries: [entry('pf2e.classes', 'F', 'Fighter')] },
      [playtest]: { entries: [entry(playtest, 'F2', 'Fighter')] },
    });
    expect((await classChoices(game)).map((each) => each.name)).toEqual([
      'Fighter (Classes)',
      `Fighter (${playtest})`,
    ]);
  });

  it('offers nothing without Foundry or its compendiums', async () => {
    expect(await classChoices(undefined)).toEqual([]);
    expect(await classChoices({})).toEqual([]);
  });
});

describe('the Dual Class variant note', () => {
  const settings = (registered: boolean, value: unknown, system?: string): ChoiceGame => ({
    ...(system === undefined ? {} : { system: { id: system } }),
    settings: {
      settings: { has: (key) => registered && key === `${system ?? 'pf2e'}.dualClassVariant` },
      get: (namespace, key) =>
        namespace === (system ?? 'pf2e') && key === 'dualClassVariant' ? value : undefined,
    },
  });

  it('shows when the world system has the setting and it is off', () => {
    expect(variantOff(settings(true, false))).toBe(true);
    expect(variantOff(settings(true, false, 'sf2e'))).toBe(true);
  });

  /** ⚠️ Today's PF2e registers no such setting, and reading one nobody registered throws in Foundry. */
  it('stays quiet when the setting is on, not registered, or not readable', () => {
    expect(variantOff(settings(true, true))).toBe(false);
    expect(variantOff(settings(false, false))).toBe(false);
    expect(variantOff({ settings: { get: () => false } })).toBe(false);
    expect(variantOff(undefined)).toBe(false);
  });
});
