/**
 * A character as ComeOnOverUno's "Foundry VTT" export writes it (`FoundryVttExportService`, camelCase JSON),
 * cut to what the import reads plus enough of the rest to prove the rest is ignored. 2026-10-05.
 */
export const COO_EXPORT = {
  name: 'Theo Ironhand',
  type: 'character',
  system: {
    abilities: {
      str: { mod: 4 },
      dex: { mod: 1 },
      con: { mod: 2 },
      int: { mod: 0 },
      wis: { mod: 1 },
      cha: { mod: -1 },
    },
    attributes: { hp: { value: 20, max: 20, temp: 0 }, speed: { value: 20, otherSpeeds: [] } },
    details: {
      level: { value: 1 },
      alignment: { value: '' },
      keyability: { value: 'STR' },
      languages: { value: ['common', 'dwarven'] },
      xp: { value: 0 },
    },
    skills: { athletics: { rank: 1 } },
  },
  items: [
    { name: 'Dwarf', type: 'ancestry', system: { hp: 10, speed: 20, size: 'med' } },
    { name: 'Rock Dwarf', type: 'heritage', system: {} },
    { name: 'Acolyte', type: 'background', system: {} },
    { name: 'Fighter', type: 'class', system: { keyAbility: { value: ['str'] }, hp: 10 } },
    {
      name: 'Dwarven Weapon Familiarity',
      type: 'feat',
      system: { level: { value: 1 }, category: 'ancestry' },
    },
    { name: 'Sudden Charge', type: 'feat', system: { level: { value: 1 }, category: 'class' } },
    { name: 'Scribing Lore', type: 'lore', system: { proficient: { value: 1 } } },
    { name: 'Shield', type: 'spell', system: { level: { value: 0 } } },
  ],
  priority: 0,
};
