import { describe, expect, it } from 'vitest';

import { guideFinished, guideSteps } from '../../src/welcome/buildGuide.js';
import type { GuideActor } from '../../src/welcome/buildGuide.js';

/** The new player's checklist, read from the sheet. Shapes measured on PF2e 8.5, 2026-10-05. */
const EMPTY: GuideActor = {
  system: { build: { attributes: { boosts: { '1': [] }, allowedBoosts: { '1': 4 } } } },
  gearCount: 0,
};

const FILLED: GuideActor = {
  ancestry: {
    name: 'Dwarf',
    system: {
      boosts: {
        a: { value: ['con'], selected: 'con' },
        b: { value: ['str', 'dex'], selected: 'str' },
      },
    },
  },
  heritage: { name: 'Rock Dwarf' },
  background: {
    name: 'Acolyte',
    system: { boosts: { a: { value: ['int', 'wis'], selected: 'wis' } } },
  },
  class: { name: 'Fighter', system: { keyAbility: { value: ['str', 'dex'], selected: 'str' } } },
  system: {
    build: {
      attributes: { boosts: { '1': ['str', 'dex', 'con', 'wis'] }, allowedBoosts: { '1': 4 } },
    },
  },
  gearCount: 3,
};

const done = (actor: GuideActor) =>
  Object.fromEntries(guideSteps(actor).map((step) => [step.key, step.done]));

describe('the checklist', () => {
  it('has nothing done on an empty sheet', () => {
    expect(Object.values(done(EMPTY)).some(Boolean)).toBe(false);
    expect(guideFinished(guideSteps(EMPTY))).toBe(false);
  });

  it('is finished on a complete sheet, naming what was picked', () => {
    const steps = guideSteps(FILLED);
    expect(guideFinished(steps)).toBe(true);
    expect(steps.map((step) => step.detail)).toEqual([
      'Dwarf',
      'Rock Dwarf',
      'Acolyte',
      'Fighter',
      null,
      '3 items',
    ]);
  });

  it('leaves boosts undone while an ancestry boost is still to choose', () => {
    const actor: GuideActor = {
      ...FILLED,
      ancestry: {
        name: 'Human',
        system: { boosts: { a: { value: ['str', 'dex'], selected: null } } },
      },
    };
    expect(done(actor)['boosts']).toBe(false);
  });

  it('leaves boosts undone while the free level 1 boosts are not all spent', () => {
    const actor: GuideActor = {
      ...FILLED,
      system: { build: { attributes: { boosts: { '1': ['str'] }, allowedBoosts: { '1': 4 } } } },
    };
    expect(done(actor)['boosts']).toBe(false);
  });

  it('leaves boosts undone while the class key attribute is unchosen', () => {
    const actor: GuideActor = {
      ...FILLED,
      class: { name: 'Fighter', system: { keyAbility: { value: ['str', 'dex'], selected: null } } },
    };
    expect(done(actor)['boosts']).toBe(false);
  });

  /** ⚠️ Before the ancestry, background and class are in, there is nothing to choose from yet. */
  it('leaves boosts undone until ancestry, background and class are all on the sheet', () => {
    expect(done({ ...FILLED, class: null })['boosts']).toBe(false);
  });

  it('counts boosts as done when the sheet is set to manual attributes', () => {
    const actor: GuideActor = { ...EMPTY, system: { build: { attributes: { manual: true } } } };
    expect(done(actor)['boosts']).toBe(true);
  });
});
