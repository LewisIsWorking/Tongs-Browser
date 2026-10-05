import { describe, expect, it, vi } from 'vitest';

import {
  actorMadeFor,
  answerRequest,
  gearCount,
  ownCharacters,
  pendingRequests,
} from '../../src/welcome/welcomeDocuments.js';
import type { WelcomeActor, WelcomeGame, WelcomeUser } from '../../src/welcome/welcomeDocuments.js';

/** The welcome's document listings: GM ones return nothing to a player. 2026-10-05. */
const flagged =
  (flags: Record<string, unknown>) =>
  (scope: string, key: string): unknown =>
    scope === 'tongs-browser' ? flags[key] : undefined;

const request = { id: 'r1', name: 'Theo', at: 1 };
const users: WelcomeUser[] = [
  { id: 'u1', name: 'Melody', getFlag: flagged({ sheetRequest: request }) },
  { id: 'u2', name: 'Kai', getFlag: flagged({}) },
  { id: 'gm', name: 'GM', isGM: true, getFlag: flagged({ sheetRequest: request }) },
  { id: 'u3', name: 'Bad', getFlag: flagged({ sheetRequest: { id: '' } }) },
];
const actor = (overrides: Partial<WelcomeActor>): WelcomeActor => ({
  id: 'a1',
  uuid: 'Actor.a1',
  name: 'Theo',
  type: 'character',
  ...overrides,
});
const game = (isGM: boolean, actors: WelcomeActor[] = []): WelcomeGame => ({
  user: { id: isGM ? 'gm' : 'u1', isGM },
  users: { contents: users },
  actors: { contents: actors },
});

describe('the GM listings', () => {
  it('lists players with a well formed request, never a GM', () => {
    expect(pendingRequests(game(true))).toEqual([
      {
        userId: 'u1',
        userName: 'Melody',
        request: { ...request, partyUuid: null, importBuild: null },
      },
    ]);
  });

  it('finds the sheet already made for a request', () => {
    const made = actor({ uuid: 'Actor.made', getFlag: flagged({ madeForRequest: 'r1' }) });
    expect(actorMadeFor(game(true, [actor({}), made]), 'r1')).toBe('Actor.made');
    expect(actorMadeFor(game(true, [actor({})]), 'r1')).toBeNull();
  });

  it('gives a player nothing from either', () => {
    const made = actor({ getFlag: flagged({ madeForRequest: 'r1' }) });
    expect(pendingRequests(game(false))).toEqual([]);
    expect(actorMadeFor(game(false, [made]), 'r1')).toBeNull();
  });
});

describe('the player listing', () => {
  /** ⚠️ Only sheets they OWN: a limited view of somebody else's is not theirs. */
  it('keeps only character sheets the player owns', () => {
    const mine = actor({ isOwner: true });
    const list = [
      mine,
      actor({ isOwner: false }),
      actor({ type: 'npc', isOwner: true }),
      actor({}),
    ];
    expect(ownCharacters(game(false, list))).toEqual([mine]);
  });

  it('counts gear, and none when there is no inventory', () => {
    expect(gearCount(actor({ inventory: { contents: [1, 2] } }))).toBe(2);
    expect(gearCount(actor({}))).toBe(0);
  });
});

describe('answering', () => {
  it('clears the request, writes the answer and assigns the sheet, in one update', async () => {
    const update = vi.fn(async () => Promise.resolve());
    const player: WelcomeUser = { id: 'u1', update, character: null };
    await answerRequest({ user: { id: 'gm', isGM: true }, users: { contents: [player] } }, 'u1', {
      kind: 'created',
      requestId: 'r1',
      actorUuid: 'Actor.NEW',
    });
    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith({
      'flags.tongs-browser.-=sheetRequest': null,
      'flags.tongs-browser.sheetResult': {
        kind: 'created',
        requestId: 'r1',
        actorUuid: 'Actor.NEW',
      },
      character: 'NEW',
    });
  });

  it('leaves an assigned character alone, and assigns nothing for a refusal', async () => {
    const update = vi.fn(async () => Promise.resolve());
    const gm = { id: 'gm', isGM: true };
    const owner: WelcomeUser = { id: 'u1', update, character: { id: 'OLD' } };
    await answerRequest({ user: gm, users: { contents: [owner] } }, 'u1', {
      kind: 'created',
      requestId: 'r1',
      actorUuid: 'Actor.NEW',
    });
    await answerRequest({ user: gm, users: { contents: [{ id: 'u1', update }] } }, 'u1', {
      kind: 'refused',
      requestId: 'r2',
      reason: 'no',
    });
    for (const [data] of update.mock.calls as unknown as [Record<string, unknown>][]) {
      expect(data).not.toHaveProperty('character');
    }
  });

  it('writes nothing from a player browser', async () => {
    const update = vi.fn(async () => Promise.resolve());
    await answerRequest(
      { user: { id: 'u1', isGM: false }, users: { contents: [{ id: 'u1', update }] } },
      'u1',
      { kind: 'refused', requestId: 'r1', reason: 'no' }
    );
    expect(update).not.toHaveBeenCalled();
  });
});
