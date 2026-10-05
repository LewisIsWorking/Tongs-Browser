import { describe, expect, it } from 'vitest';

import {
  DEFAULT_NAME,
  cleanName,
  readSheetRequest,
  readSheetResult,
} from '../../src/welcome/sheetRequest.js';
import { campaignParties, pickParty } from '../../src/welcome/campaignParty.js';

/** A new player's request and the GM's answer, both read from flags a browser wrote. 2026-10-05. */
describe('the name a sheet is given', () => {
  it('trims and collapses spaces', () => {
    expect(cleanName('  Arktos   the  Bold ')).toBe('Arktos the Bold');
  });

  it('falls back to a default when blank or not text', () => {
    expect(cleanName('   ')).toBe(DEFAULT_NAME);
    expect(cleanName(42)).toBe(DEFAULT_NAME);
  });

  it('is cut to 60 characters', () => {
    expect(cleanName('a'.repeat(80))).toHaveLength(60);
  });
});

describe('reading a request', () => {
  it('reads a well formed request, cleaning its name', () => {
    expect(readSheetRequest({ id: 'r1', name: ' Vex ', partyUuid: 'Actor.P', at: 5 })).toEqual({
      id: 'r1',
      name: 'Vex',
      partyUuid: 'Actor.P',
      at: 5,
    });
  });

  it('reads a missing or empty party as no choice', () => {
    expect(readSheetRequest({ id: 'r1', at: 5 })?.partyUuid).toBeNull();
    expect(readSheetRequest({ id: 'r1', at: 5, partyUuid: '' })?.partyUuid).toBeNull();
  });

  it.each([null, 'text', {}, { id: '', at: 1 }, { id: 'r1' }, { id: 7, at: 1 }])(
    'reads %j as no request',
    (raw) => {
      expect(readSheetRequest(raw)).toBeNull();
    }
  );
});

describe('reading an answer', () => {
  it('reads a made sheet and a refusal', () => {
    expect(readSheetResult({ kind: 'created', requestId: 'r1', actorUuid: 'Actor.A' })).toEqual({
      kind: 'created',
      requestId: 'r1',
      actorUuid: 'Actor.A',
    });
    expect(readSheetResult({ kind: 'refused', requestId: 'r1', reason: 'no' })).toEqual({
      kind: 'refused',
      requestId: 'r1',
      reason: 'no',
    });
  });

  it.each([
    null,
    { kind: 'created', requestId: 'r1' },
    { kind: 'refused', requestId: 'r1' },
    { kind: 'other', requestId: 'r1' },
    { kind: 'created', actorUuid: 'Actor.A' },
  ])('reads %j as no answer', (raw) => {
    expect(readSheetResult(raw)).toBeNull();
  });
});

describe('the campaign party', () => {
  const party = (uuid: string, campaign: unknown) => ({ uuid, name: `Party ${uuid}`, campaign });

  it('keeps only parties with a real campaign code', () => {
    expect(
      campaignParties([party('A', 'c06 '), party('B', 'Kibwe'), party('C', undefined)])
    ).toEqual([{ uuid: 'A', name: 'Party A', code: 'C06' }]);
  });

  const one = campaignParties([party('A', 'C06')]);
  const two = campaignParties([party('A', 'C06'), party('B', 'C07')]);

  it('takes the only campaign party when the player chose none', () => {
    expect(pickParty(null, one)).toEqual({ kind: 'party', party: one[0] });
  });

  it('takes the one the player chose', () => {
    expect(pickParty('B', two)).toEqual({ kind: 'party', party: two[1] });
  });

  it('waits when there is no campaign party, or several and no choice', () => {
    expect(pickParty(null, [])).toEqual({ kind: 'none' });
    expect(pickParty(null, two)).toEqual({ kind: 'ambiguous', parties: two });
  });

  /** ⚠️ The GM's browser may act days later, after the chosen party lost its code. */
  it('falls back when the chosen party is no longer a campaign party', () => {
    expect(pickParty('GONE', one)).toEqual({ kind: 'party', party: one[0] });
    expect(pickParty('GONE', two).kind).toBe('ambiguous');
  });
});
