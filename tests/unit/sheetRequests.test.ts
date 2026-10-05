import { describe, expect, it } from 'vitest';

import { SheetRequests } from '../../src/welcome/SheetRequests.js';
import type { PendingUser, SheetRequestPorts } from '../../src/welcome/SheetRequests.js';
import type { SheetCreationOutcome } from '../../src/foundry/SheetCreationTypes.js';
import type { SheetResult } from '../../src/welcome/sheetRequest.js';

/** The GM's browser serving new players' requests. 2026-10-05. */
const PARTY = { uuid: 'Actor.P', name: 'The Party', code: 'C06' };

function world(overrides: Partial<SheetRequestPorts> = {}) {
  const answers: { userId: string; result: SheetResult }[] = [];
  const told: string[] = [];
  const created: string[] = [];
  let pending: PendingUser[] = [
    {
      userId: 'u1',
      userName: 'Melody',
      request: { id: 'r1', name: 'Theo', partyUuid: null, at: 1, importBuild: null },
    },
  ];
  const ports: SheetRequestPorts = {
    isDesignatedGm: () => true,
    pending: () => pending,
    campaignParties: () => [PARTY],
    madeFor: () => null,
    create: async (sheet): Promise<SheetCreationOutcome> => {
      created.push(`${sheet.name}:${sheet.ownerId}:${sheet.partyUuid}:${sheet.requestId}`);
      return Promise.resolve({ kind: 'created', sheet: { uuid: 'Actor.NEW' } });
    },
    answer: async (userId, result) => {
      answers.push({ userId, result });
      pending = pending.filter((user) => user.userId !== userId);
      return Promise.resolve();
    },
    tellGm: (text) => told.push(text),
    ...overrides,
  };
  return { requests: new SheetRequests(ports), answers, told, created };
}

describe('serving a request', () => {
  it('makes the sheet in the campaign party, answers the player and tells the GM', async () => {
    const { requests, answers, told, created } = world();
    await requests.serve();
    expect(created).toEqual(['Theo:u1:Actor.P:r1']);
    expect(answers).toEqual([
      { userId: 'u1', result: { kind: 'created', requestId: 'r1', actorUuid: 'Actor.NEW' } },
    ]);
    expect(told).toEqual(['Tongs made Theo for Melody, in The Party.']);
  });

  it('does nothing unless this browser is the designated GM', async () => {
    const { requests, answers, created } = world({ isDesignatedGm: () => false });
    await requests.serve();
    expect(created).toEqual([]);
    expect(answers).toEqual([]);
  });

  /** ⚠️ A pass that made the sheet and then failed to answer must not make a second one. */
  it('answers with the sheet already made for the request, without making another', async () => {
    const { requests, answers, created } = world({ madeFor: () => 'Actor.OLD' });
    await requests.serve();
    expect(created).toEqual([]);
    expect(answers[0]?.result).toEqual({
      kind: 'created',
      requestId: 'r1',
      actorUuid: 'Actor.OLD',
    });
  });

  it('turns the request down, saying why, when the sheet cannot be made', async () => {
    const { requests, answers, told } = world({
      create: async () => Promise.resolve({ kind: 'notCreated', reason: 'Foundry said no.' }),
    });
    await requests.serve();
    expect(answers[0]?.result).toEqual({
      kind: 'refused',
      requestId: 'r1',
      reason: 'Foundry said no.',
    });
    expect(told).toEqual(["Tongs could not make Melody's character: Foundry said no."]);
  });

  it('still answers "made" when the sheet could not join the party, and tells the GM', async () => {
    const { requests, answers, told } = world({
      create: async () =>
        Promise.resolve({
          kind: 'createdOutsideParty',
          sheet: { uuid: 'Actor.NEW' },
          reason: 'locked',
        }),
    });
    await requests.serve();
    expect(answers[0]?.result.kind).toBe('created');
    expect(told).toEqual(['Tongs made Theo for Melody, but could not add it to The Party: locked']);
  });
});

describe('a request that has to wait', () => {
  it('keeps it, and tells the GM once, when no party has a campaign code', async () => {
    const { requests, answers, told } = world({ campaignParties: () => [] });
    await requests.serve();
    await requests.serve();
    expect(answers).toEqual([]);
    expect(told).toHaveLength(1);
    expect(told[0]).toContain('no party here has a campaign code');
  });

  it('keeps it when several campaign parties exist and none was chosen', async () => {
    const other = { uuid: 'Actor.Q', name: 'Other', code: 'C07' };
    const { requests, answers, told } = world({ campaignParties: () => [PARTY, other] });
    await requests.serve();
    expect(answers).toEqual([]);
    expect(told[0]).toContain('several campaign parties');
  });
});

describe('one pass at a time', () => {
  /** ⚠️ The answer fires `updateUser`, which calls serve again while the first pass is still working. */
  it('runs a call made mid-pass as one more pass, never alongside', async () => {
    let calls = 0;
    let inFlight = 0;
    let most = 0;
    const holder: { requests?: SheetRequests } = {};
    const { requests, created } = world({
      create: async (sheet) => {
        inFlight += 1;
        most = Math.max(most, inFlight);
        calls += 1;
        if (calls === 1) await holder.requests?.serve();
        inFlight -= 1;
        return Promise.resolve({ kind: 'created', sheet: { uuid: `Actor.${sheet.requestId}` } });
      },
    });
    holder.requests = requests;
    await requests.serve();
    expect(most).toBe(1);
    expect(created).toEqual([]);
    expect(calls).toBe(1);
  });
});
