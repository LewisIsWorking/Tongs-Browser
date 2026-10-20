import { describe, expect, it } from 'vitest';

import { ruleOn, variantRules, WORKBENCH } from '../../src/welcome/variantRules.js';

/** Which variant rules a new player meets: Workbench's two, and the system's Free Archetype. 2026-10-20. */
const settings = (values: Record<string, unknown>) => ({
  get: (namespace: string, key: string): unknown => {
    const full = `${namespace}.${key}`;
    if (!(full in values)) {
      throw new Error(`${full} is not a registered game setting`);
    }
    return values[full];
  },
});

describe('reading a variant rule', () => {
  it('is on only for a setting that is exactly true', () => {
    const world = settings({ 'a.on': true, 'a.off': false, 'a.text': 'true' });
    expect(ruleOn(world, 'a', 'on')).toBe(true);
    expect(ruleOn(world, 'a', 'off')).toBe(false);
    expect(ruleOn(world, 'a', 'text')).toBe(false);
  });

  it('reads a setting nobody registered (Foundry throws) as off, and no settings at all as off', () => {
    expect(ruleOn(settings({}), WORKBENCH, 'legacyVariantRuleDualClass')).toBe(false);
    expect(ruleOn(undefined, WORKBENCH, 'legacyVariantRuleDualClass')).toBe(false);
  });
});

describe('the world’s variant rules', () => {
  const all = {
    'xdy-pf2e-workbench.legacyVariantRuleDualClass': true,
    'xdy-pf2e-workbench.legacyVariantRuleAncestryParagon': true,
    'pf2e.freeArchetypeVariant': true,
    'sf2e.freeArchetypeVariant': true,
  };

  it('reads all three when they are on, under PF2e or SF2e', () => {
    const on = { dualClass: true, ancestryParagon: true, freeArchetype: true };
    expect(variantRules(settings(all), 'pf2e')).toEqual(on);
    expect(variantRules(settings(all), 'sf2e')).toEqual(on);
    expect(variantRules(settings(all), undefined)).toEqual(on);
  });

  it('reads each one off by itself', () => {
    const some = settings({
      'xdy-pf2e-workbench.legacyVariantRuleDualClass': false,
      'xdy-pf2e-workbench.legacyVariantRuleAncestryParagon': true,
      'pf2e.freeArchetypeVariant': false,
    });
    expect(variantRules(some, 'pf2e')).toEqual({
      dualClass: false,
      ancestryParagon: true,
      freeArchetype: false,
    });
  });

  it('is all off without Workbench, and Free Archetype off under any other system', () => {
    const none = { dualClass: false, ancestryParagon: false, freeArchetype: false };
    expect(variantRules(settings({}), 'pf2e')).toEqual(none);
    expect(variantRules(settings({ 'dnd5e.freeArchetypeVariant': true }), 'dnd5e')).toEqual(none);
  });
});
