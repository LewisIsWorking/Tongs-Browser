import { describe, expect, it } from 'vitest';

import { guideFinished, guideSteps } from '../../src/welcome/buildGuide.js';
import type { GuideActor } from '../../src/welcome/buildGuide.js';
import { guideView, PARAGON_GROUP } from '../../src/welcome/guideView.js';
import type { GuideSheet } from '../../src/welcome/guideView.js';
import { ARCHETYPE_NOTE, DUAL_NOTE, PARAGON_NOTE } from '../../src/welcome/variantSteps.js';

/** The checklist's variant rule steps: each only while its rule is on, none holding back "ready". 2026-10-20. */
const BUILT: GuideActor = {
  ancestry: { name: 'Dwarf' },
  heritage: { name: 'Rock Dwarf' },
  background: { name: 'Acolyte' },
  class: { name: 'Fighter' },
  system: { build: { attributes: { manual: true } } },
  gearCount: 1,
};
const OFF = { dualClass: false, ancestryParagon: false, freeArchetype: false };
const ON = { dualClass: true, ancestryParagon: true, freeArchetype: true };
const keys = (actor: GuideActor, rules = ON) => guideSteps(actor, rules).map((step) => step.key);

describe('the variant rule steps', () => {
  it('are absent with every rule off, or with no rules given', () => {
    expect(keys(BUILT, OFF)).toEqual([
      'ancestry',
      'heritage',
      'background',
      'class',
      'boosts',
      'gear',
    ]);
    expect(guideSteps(BUILT).length).toBe(6);
  });

  it('each appears only while its own rule is on', () => {
    expect(keys(BUILT, { ...OFF, dualClass: true }).slice(6)).toEqual(['dualClass']);
    expect(keys(BUILT, { ...OFF, ancestryParagon: true }).slice(6)).toEqual(['ancestryParagon']);
    expect(keys(BUILT, { ...OFF, freeArchetype: true }).slice(6)).toEqual(['freeArchetype']);
    expect(keys(BUILT).slice(6)).toEqual(['dualClass', 'ancestryParagon', 'freeArchetype']);
  });

  it('say what to do, in slots, with a button for the dual class', () => {
    const steps = guideSteps(BUILT, ON).slice(6);
    expect(steps.map((step) => step.note)).toEqual([DUAL_NOTE, PARAGON_NOTE, ARCHETYPE_NOTE]);
    expect(steps[0]).toMatchObject({
      label: 'Pick your dual class',
      done: false,
      action: 'dualClass',
    });
    expect(PARAGON_NOTE).toContain('slots');
    expect(ARCHETYPE_NOTE).toContain('level 2');
    expect(steps[2]).toMatchObject({ done: false, detail: 'From level 2' });
  });

  it('tick from the sheet: the dual class by name, Ancestry Paragon by its feats', () => {
    const steps = guideSteps({ ...BUILT, dualClass: 'Fighter - Wizard', paragonFeats: 2 }, ON);
    expect(steps.slice(6, 8)).toMatchObject([
      { done: true, detail: 'Fighter - Wizard' },
      { done: true, detail: '2 feats' },
    ]);
    expect(steps[6]?.action).toBeUndefined();
    expect(steps[7]?.note).toBeUndefined();
    expect(guideSteps({ ...BUILT, paragonFeats: 1 }, ON)[7]?.detail).toBe('1 feat');
  });

  it('never hold back "ready", and never stand in for a basic step', () => {
    expect(guideFinished(guideSteps(BUILT, ON))).toBe(true);
    expect(guideFinished(guideSteps({ ...BUILT, class: null }, ON))).toBe(false);
  });
});

describe('the sheet as the checklist reads it', () => {
  const item = (type: string, extra: Record<string, unknown> = {}, dualFor?: string) => ({
    id: type,
    type,
    ...extra,
    getFlag: (scope: string, key: string) =>
      scope === 'tongs-browser' && key === 'dualClassFor' ? dualFor : undefined,
  });
  const sheet = (items: ReturnType<typeof item>[]): GuideSheet => ({
    id: 'A',
    uuid: 'Actor.A',
    name: 'Theo',
    type: 'character',
    items: { contents: items },
  });

  it('finds the dual class Tongs gave, or the macro made, and only that', () => {
    expect(guideView(sheet([item('class', { name: 'Fighter' })])).dualClass).toBeNull();
    const dual = sheet([item('class', { name: 'Fighter - Wizard' }, 'r1')]);
    expect(guideView(dual).dualClass).toBe('Fighter - Wizard');
    expect(guideView(sheet([item('class', {}, 'r1')])).dualClass).toBe('Dual class');
    const macro = { slug: 'rogue', rules: [{ key: 'RollOption', option: 'class:bard' }] };
    expect(guideView(sheet([item('class', { name: 'Rogue', system: macro })])).dualClass).toBe(
      'Rogue'
    );
  });

  it('counts the feats in the Ancestry Paragon section only', () => {
    const view = guideView(
      sheet([
        item('feat', { system: { location: `${PARAGON_GROUP}-1` } }),
        item('feat', { system: { location: 'ancestry-1' } }),
        item('feat', { system: { location: null } }),
        item('weapon', { system: { location: `${PARAGON_GROUP}-1` } }),
      ])
    );
    expect(view.paragonFeats).toBe(1);
    expect(
      guideView({ id: 'A', uuid: 'Actor.A', name: null, type: 'character' }).paragonFeats
    ).toBe(0);
  });
});
