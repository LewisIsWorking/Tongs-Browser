import { describe, expect, it } from 'vitest';

import {
  CLASS_PACKS,
  packOf,
  readDualClassRequest,
  readDualClassResult,
} from '../../src/dualclass/dualClassRequest.js';

/** The request and answer flags, read as the untrusted input they are. 2026-10-12. */
const REQUEST = {
  id: 'r1',
  actorId: 'A1',
  first: 'Compendium.pf2e.classes.Item.F',
  second: 'Compendium.pf2e.classes.Item.W',
  at: 5,
};
const ITEM = { name: 'Fighter - Wizard', type: 'class', img: 'x', system: {} };

describe('the class compendiums', () => {
  it('are the macro list, in its order, with SF2e classes added last', () => {
    expect(CLASS_PACKS).toEqual([
      'pf2e.classes',
      'battlezoo-eldamon-pf2e.classes',
      'sf2e-anachronism.classes',
      'starfinder-field-test-for-pf2e.classes',
      'pf2e-playtest-data.battlecry-playtest-classes',
      'pf2e-playtest-data.impossible-playtest-classes',
      'sf2e.classes',
    ]);
  });

  it('reads the pack out of a compendium UUID, and nothing out of anything else', () => {
    expect(packOf('Compendium.pf2e.classes.Item.abc')).toBe('pf2e.classes');
    expect(packOf('Compendium.pf2e.classes')).toBeNull();
    expect(packOf('Actor.A1.Item.abc')).toBeNull();
  });
});

describe('a request', () => {
  it('reads a well formed request', () => {
    expect(readDualClassRequest(REQUEST)).toEqual(REQUEST);
  });

  it.each([
    ['nothing', undefined],
    ['a string', 'r1'],
    ['an array', [REQUEST]],
    ['no id', { ...REQUEST, id: '' }],
    ['no sheet', { ...REQUEST, actorId: 4 }],
    ['no 1st class', { ...REQUEST, first: '' }],
    ['no 2nd class', { ...REQUEST, second: null }],
    ['no time', { ...REQUEST, at: 'now' }],
  ])('reads %s as no request', (_what, raw) => {
    expect(readDualClassRequest(raw)).toBeNull();
  });
});

describe('an answer', () => {
  it('reads a dual class built for a sheet', () => {
    const built = { kind: 'built', requestId: 'r1', actorId: 'A1', item: ITEM };
    expect(readDualClassResult(built)).toEqual(built);
  });

  it('reads a refusal with its reason', () => {
    const refused = { kind: 'refused', requestId: 'r1', reason: 'No.' };
    expect(readDualClassResult(refused)).toEqual(refused);
  });

  it.each([
    ['nothing', null],
    ['no request id', { kind: 'refused', reason: 'No.' }],
    ['a refusal without a reason', { kind: 'refused', requestId: 'r1', reason: '' }],
    ['an unknown kind', { kind: 'maybe', requestId: 'r1', reason: 'x' }],
    ['a dual class with no sheet', { kind: 'built', requestId: 'r1', item: ITEM }],
    ['a dual class with no item', { kind: 'built', requestId: 'r1', actorId: 'A1' }],
    [
      'an item that is not a class',
      { kind: 'built', requestId: 'r1', actorId: 'A1', item: { ...ITEM, type: 'feat' } },
    ],
    [
      'an item with no name',
      { kind: 'built', requestId: 'r1', actorId: 'A1', item: { ...ITEM, name: '' } },
    ],
    [
      'an item with no system',
      { kind: 'built', requestId: 'r1', actorId: 'A1', item: { ...ITEM, system: [] } },
    ],
  ])('reads %s as no answer', (_what, raw) => {
    expect(readDualClassResult(raw)).toBeNull();
  });
});
