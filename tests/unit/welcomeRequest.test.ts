import { describe, expect, it } from 'vitest';

import {
  DEFAULT_NAME,
  cleanName,
  readSheetRequest,
  readSheetResult,
} from '../../src/welcome/sheetRequest.js';
import { campaignParties, pickParty } from '../../src/welcome/campaignParty.js';
import { readPartyCampaigns } from '../../src/foundry/PartyAccess.js';

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
      importBuild: null,
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

  /** Lewis, 2026-10-08: a canonical primary party per world, so a world nobody set up still makes sheets. */
  it("falls back to the world's primary party when no party has a code", () => {
    const primary = { ...party('P', undefined), primary: true };
    const parties = campaignParties([party('B', 'Kibwe'), primary]);
    expect(parties).toEqual([{ uuid: 'P', name: 'Party P', code: '', primary: true }]);
    expect(pickParty(null, parties)).toEqual({ kind: 'party', party: parties[0] });
    expect(campaignParties([party('A', 'C06'), primary])).toEqual([
      { uuid: 'A', name: 'Party A', code: 'C06' },
    ]);
    expect(campaignParties([party('B', 'Kibwe')])).toEqual([]);
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

describe("the world's primary party", () => {
  it("is marked from PF2e's active party", () => {
    const party = (name: string) => ({
      type: 'party',
      name,
      uuid: `Actor.${name}`,
      getFlag: () => undefined,
    });
    const parties = [party('The Party'), party('Kibwe')];
    const actors = Object.assign(parties, { party: parties[0] });
    const read = readPartyCampaigns({
      getGame: () => ({ actors: actors as never, user: { isGM: true } }),
    });
    expect(read.map((p) => [p.name, p.primary])).toEqual([
      ['The Party', true],
      ['Kibwe', false],
    ]);
  });
});
