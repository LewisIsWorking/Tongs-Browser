import type { ClassSource } from '../../../src/dualclass/buildDualClass.js';

/**
 * Class items for the dual class tests, shaped as PF2e's own `packs/pf2e/classes/*.json` (v14-dev,
 * 2026-10-12): the Fighter's and Wizard's real ranks, trimmed to a couple of features each. The Ranger is
 * the one that caught the macro's medium armour typo: heavy 0, medium 1.
 */
type System = Record<string, unknown>;

const base = (over: System): System => ({
  ancestryFeatLevels: { value: [1, 5, 9, 13, 17] },
  attacks: { advanced: 0, martial: 0, other: { name: '', rank: 0 }, simple: 1, unarmed: 1 },
  defenses: { heavy: 0, light: 0, medium: 0, unarmored: 1 },
  description: { value: '<p>Base.</p>' },
  hp: 6,
  items: {},
  keyAbility: { value: ['int'] },
  perception: 1,
  rules: [],
  savingThrows: { fortitude: 1, reflex: 1, will: 1 },
  skillFeatLevels: { value: [2, 4, 6, 8] },
  skillIncreaseLevels: { value: [3, 5, 7] },
  trainedSkills: { additional: 2, value: [] },
  ...over,
});

export const classSource = (name: string, over: System = {}): ClassSource => ({
  name,
  system: base(over),
});

export const fighter = (over: System = {}): ClassSource =>
  classSource('Fighter', {
    slug: 'fighter',
    attacks: { advanced: 1, martial: 2, other: { name: '', rank: 0 }, simple: 2, unarmed: 2 },
    defenses: { heavy: 1, light: 1, medium: 1, unarmored: 1 },
    description: { value: '<p>Fighter.</p>' },
    hp: 10,
    items: {
      '0c3e5': { level: 13, name: 'Weapon Legend', uuid: 'Compendium.pf2e.classfeatures.Item.WL' },
      '2jey6': {
        level: 11,
        name: 'Fighter Expertise',
        uuid: 'Compendium.pf2e.classfeatures.Item.FE',
      },
    },
    keyAbility: { value: ['dex', 'str'] },
    perception: 2,
    rules: [{ flag: 'fighterSkill', key: 'ChoiceSet', prompt: 'PF2E.SpecificRule.Prompt.Skill' }],
    savingThrows: { fortitude: 2, reflex: 2, will: 1 },
    skillFeatLevels: { value: [2, 4, 6, 8, 10] },
    skillIncreaseLevels: { value: [3, 5, 7, 9] },
    trainedSkills: { additional: 3, value: [] },
    ...over,
  });

export const wizard = (over: System = {}): ClassSource =>
  classSource('Wizard', {
    slug: 'wizard',
    description: { value: '<p>Wizard.</p>' },
    items: {
      '13v1o': {
        level: 1,
        name: 'Wizard Spellcasting',
        uuid: 'Compendium.pf2e.classfeatures.Item.WS',
      },
      '3XT0E': { level: 1, name: 'Arcane School', uuid: 'Compendium.pf2e.classfeatures.Item.AS' },
    },
    savingThrows: { fortitude: 1, reflex: 1, will: 2 },
    skillIncreaseLevels: { value: [3, 5, 7, 11] },
    trainedSkills: { additional: 2, value: ['arcana'] },
    ...over,
  });

export const ranger = (over: System = {}): ClassSource =>
  classSource('Ranger', {
    slug: 'ranger',
    defenses: { heavy: 0, light: 1, medium: 1, unarmored: 1 },
    ...over,
  });

/** A field of the built item's `system`, read the way a test wants it. */
export const field = (system: System, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) => (value as System | undefined)?.[key], system);
