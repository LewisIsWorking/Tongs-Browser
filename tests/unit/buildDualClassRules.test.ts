import { describe, expect, it } from 'vitest';

import { buildDualClass } from '../../src/dualclass/buildDualClass.js';
import { classSource, field, fighter, wizard } from './support/dualClasses.js';

/** The macro's rules, ported: items, key ability, perception, rules, saves, skills. 2026-10-12. */
const build = (first = fighter(), second = wizard()) => buildDualClass(first, second, 'img');
const feature = (uuid: string, level: number) => ({ level, name: uuid, uuid });

describe('Items', () => {
  it('grants both classes features', () => {
    expect(Object.keys(field(build().system, 'items') as object).sort()).toEqual([
      '0c3e5',
      '13v1o',
      '2jey6',
      '3XT0E',
    ]);
  });

  it('keeps a shared feature at the 1st class level when that is sooner', () => {
    const first = classSource('A', { items: { a: feature('X', 3) } });
    const second = classSource('B', { items: { b: feature('X', 5) } });
    expect(field(build(first, second).system, 'items')).toEqual({ a: feature('X', 3) });
  });

  it('moves a shared feature to the 2nd class level when that is sooner', () => {
    const first = classSource('A', { items: { a: feature('X', 7) } });
    const second = classSource('B', { items: { b: feature('X', 5) } });
    expect(field(build(first, second).system, 'items')).toEqual({ a: feature('X', 5) });
  });

  it('carries over an entry that is not a feature, as the macro did', () => {
    const second = classSource('B', { items: { odd: 'x' } });
    expect(field(build(classSource('A'), second).system, 'items')).toEqual({ odd: 'x' });
  });
});

describe('Key Ability, Perception and Saving Throws', () => {
  it('offers every key ability of both, once each', () => {
    expect(field(build().system, 'keyAbility.value')).toEqual(['dex', 'str', 'int']);
    const both = build(classSource('A', { keyAbility: { value: ['str'] } }), fighter());
    expect(field(both.system, 'keyAbility.value')).toEqual(['str', 'dex']);
  });

  it('takes the better perception', () => {
    expect(field(build(wizard(), fighter()).system, 'perception')).toBe(2);
    expect(field(build(fighter(), wizard()).system, 'perception')).toBe(2);
  });

  it('takes the better rank of each save', () => {
    expect(field(build().system, 'savingThrows')).toEqual({ fortitude: 2, reflex: 2, will: 2 });
  });
});

describe('Rules', () => {
  it('marks the 2nd class with a RollOption, after the 1st class rules', () => {
    expect(field(build().system, 'rules')).toEqual([
      { flag: 'fighterSkill', key: 'ChoiceSet', prompt: 'PF2E.SpecificRule.Prompt.Skill' },
      { domain: 'all', key: 'RollOption', option: 'class:wizard', priority: 0 },
    ]);
  });

  it('adds the 2nd class rules after it', () => {
    const rules = field(build(wizard(), fighter()).system, 'rules') as unknown[];
    expect(rules).toEqual([
      { domain: 'all', key: 'RollOption', option: 'class:fighter', priority: 0 },
      { flag: 'fighterSkill', key: 'ChoiceSet', prompt: 'PF2E.SpecificRule.Prompt.Skill' },
    ]);
  });

  it('names the RollOption from the class name when the class has no slug', () => {
    const rules = field(build(fighter(), classSource('Battle Harbinger!')).system, 'rules');
    expect(rules).toContainEqual(expect.objectContaining({ option: 'class:battle-harbinger' }));
  });

  /** ⛔ The macro's `rules.includes(rule)` compared identity, so a shared rule was added twice. */
  it('adds a rule both classes carry once', () => {
    const shared = { key: 'ActiveEffectLike', path: 'system.x', value: 1 };
    const rules = field(
      build(classSource('A', { rules: [shared] }), classSource('B', { rules: [{ ...shared }] }))
        .system,
      'rules'
    ) as unknown[];
    expect(rules.filter((rule) => JSON.stringify(rule) === JSON.stringify(shared))).toHaveLength(1);
  });

  /**
   * ⛔ The macro spliced inside `forEach`, which skips the rule after each one removed: of two martial
   *    rules in a row, the second survived. Every one is removed now.
   */
  it('drops every rule raising martial weapons to a rank the class already has', () => {
    const martial = (value: number) => ({
      key: 'ActiveEffectLike',
      path: 'data.martial.simple.rank',
      value,
    });
    const kept = { key: 'ActiveEffectLike', path: 'data.martial.simple.rank', value: 3 };
    const rules = field(
      build(classSource('A', { rules: [martial(1), martial(2), kept] }), fighter()).system,
      'rules'
    );
    expect(rules).toEqual([
      kept,
      { domain: 'all', key: 'RollOption', option: 'class:fighter', priority: 0 },
      { flag: 'fighterSkill', key: 'ChoiceSet', prompt: 'PF2E.SpecificRule.Prompt.Skill' },
    ]);
  });

  it('keeps a martial rule unless its path names data, martial and rank', () => {
    const modern = { key: 'ActiveEffectLike', path: 'system.martial.rank', value: 1 };
    const rules = field(
      build(classSource('A', { rules: [modern, 'odd'] }), fighter()).system,
      'rules'
    );
    expect(rules).toContainEqual(modern);
    expect(rules).toContainEqual('odd');
  });
});

describe('Skills', () => {
  it('merges skill feat and skill increase levels, each once, lowest first', () => {
    const item = build(wizard(), fighter());
    expect(field(item.system, 'skillFeatLevels.value')).toEqual([2, 4, 6, 8, 10]);
    expect(field(item.system, 'skillIncreaseLevels.value')).toEqual([3, 5, 7, 9, 11]);
  });

  it('sorts levels as numbers, not as text', () => {
    const item = build(
      classSource('A', { skillFeatLevels: { value: [10, 2] } }),
      classSource('B', { skillFeatLevels: { value: [9] } })
    );
    expect(field(item.system, 'skillFeatLevels.value')).toEqual([2, 9, 10]);
  });

  it('takes more additional trained skills and both classes trained skills', () => {
    const item = build(
      wizard({ trainedSkills: { additional: 2, value: ['arcana'] } }),
      fighter({ trainedSkills: { additional: 3, value: ['arcana', 'athletics'] } })
    );
    expect(field(item.system, 'trainedSkills')).toEqual({
      additional: 3,
      value: ['arcana', 'athletics'],
    });
  });
});
