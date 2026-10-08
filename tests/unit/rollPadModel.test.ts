import { describe, expect, it } from 'vitest';

import { readPad, signed } from '../../src/rollpad/padModel.js';
import { rollOnPad } from '../../src/rollpad/padRolls.js';
import { padActor } from './support/rollPadActor.js';
import type { RollCall } from './support/rollPadActor.js';

/**
 * The Roll Pad's reading of a PF2e character, and its rolls. Written 2026-10-08 for Lewis: "IT would
 * be good to be able to roll from Mobile a lot easier."
 */
describe('what the pad offers', () => {
  it('lists each visible strike with every attack step, damage and crit', () => {
    const pad = readPad(padActor());

    expect(pad?.name).toBe('Thorin');
    expect(pad?.strikes).toEqual([
      {
        index: 0,
        label: 'Longsword',
        attacks: ['Strike +9', 'MAP -5', 'MAP -10'],
        canDamage: true,
        canCritical: true,
        ready: true,
      },
      /* Index 2, not 1: the hidden strike between them still holds its place in `system.actions`. */
      {
        index: 2,
        label: 'Shortbow',
        attacks: ['Strike +7'],
        canDamage: true,
        canCritical: false,
        ready: false,
      },
    ]);
  });

  it('gives Perception then the three saves, and trained skills first', () => {
    const pad = readPad(padActor());

    expect(pad?.checks.map((check) => [check.label, check.modifier])).toEqual([
      ['Perception', 6],
      ['Fortitude', 8],
      ['Reflex', 4],
      ['Will', -1],
    ]);
    expect(pad?.skills.map((skill) => `${skill.label}:${String(skill.trained)}`)).toEqual([
      'Athletics:true',
      'Warfare Lore:true',
      'Acrobatics:false',
      'Stealth:false',
    ]);
  });

  it('drops what it cannot roll, never the pad', () => {
    const actor = {
      name: 'Odd',
      system: { actions: [null, { type: 'strike' }, { type: 'action', label: 'Raise a Shield' }] },
      perception: { label: 'Perception', roll: () => undefined },
      saves: { fortitude: { label: 'Fortitude' }, reflex: 'broken' },
      skills: { athletics: { label: '  ', roll: () => undefined } },
    };
    const pad = readPad(actor);

    expect(pad?.strikes).toEqual([]);
    expect(pad?.checks).toEqual([
      {
        group: 'perception',
        key: 'perception',
        label: 'Perception',
        modifier: null,
        trained: false,
      },
    ]);
    expect(pad?.skills).toEqual([]);
    expect(readPad({ name: 'Bare' })).toEqual({
      name: 'Bare',
      strikes: [],
      checks: [],
      skills: [],
    });
    expect(
      readPad({
        name: 'Weird',
        system: { actions: [{ type: 'strike', label: 'X', variants: [1] }] },
      })?.strikes[0]?.attacks
    ).toEqual([]);
    for (const nothing of [null, undefined, 'Thorin', { name: '' }, {}]) {
      expect(readPad(nothing)).toBeNull();
    }
  });

  it('signs a modifier the way a sheet does', () => {
    expect([signed(7), signed(0), signed(-2)]).toEqual(['+7', '+0', '-2']);
  });
});

describe('rolling through PF2e', () => {
  it('calls the method the sheet calls, on its own object, skipping the dialog for a tap', async () => {
    const calls: RollCall[] = [];
    const actor = padActor(calls);

    await rollOnPad(actor, { kind: 'attack', strike: 0, variant: 1 }, false);
    await rollOnPad(actor, { kind: 'damage', strike: 0 }, false);
    await rollOnPad(actor, { kind: 'critical', strike: 0 }, true);
    await rollOnPad(actor, { kind: 'check', group: 'perception', key: 'perception' }, false);
    await rollOnPad(actor, { kind: 'check', group: 'save', key: 'will' }, true);
    await rollOnPad(actor, { kind: 'check', group: 'skill', key: 'athletics' }, false);

    expect(calls.map((call) => [call.what, call.params])).toEqual([
      ['longsword 1', { skipDialog: true }],
      ['longsword damage', { skipDialog: true }],
      ['longsword critical', { skipDialog: false }],
      ['perception', { skipDialog: true }],
      ['will', { skipDialog: false }],
      ['athletics', { skipDialog: true }],
    ]);
    expect(calls[0]?.self).toBe(actor.system.actions[0]?.variants[1]);
    expect(calls[4]?.self).toBe(actor.saves.will);
  });

  it('says false, and rolls nothing, for a roll the actor no longer has', async () => {
    const calls: RollCall[] = [];
    const actor = padActor(calls);
    const gone = [
      rollOnPad(actor, { kind: 'attack', strike: 9, variant: 0 }, false),
      rollOnPad(actor, { kind: 'critical', strike: 2 }, false),
      rollOnPad(actor, { kind: 'check', group: 'skill', key: 'arcana' }, false),
      rollOnPad(null, { kind: 'damage', strike: 0 }, false),
      rollOnPad({ system: { actions: 'none' } }, { kind: 'damage', strike: 0 }, false),
    ];

    expect(await Promise.all(gone)).toEqual([false, false, false, false, false]);
    expect(calls).toEqual([]);
  });
});
