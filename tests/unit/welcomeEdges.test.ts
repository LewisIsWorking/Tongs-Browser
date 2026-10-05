import { describe, expect, it, vi } from 'vitest';

import { guideSteps } from '../../src/welcome/buildGuide.js';
import type { GuideActor } from '../../src/welcome/buildGuide.js';
import { SheetRequests } from '../../src/welcome/SheetRequests.js';
import type { SheetResult } from '../../src/welcome/sheetRequest.js';
import { startSheetRequests } from '../../src/welcome/startSheetRequests.js';
import type { WelcomeGlobals } from '../../src/welcome/startSheetRequests.js';
import {
  actorMadeFor,
  answerRequest,
  ownCharacters,
  pendingRequests,
} from '../../src/welcome/welcomeDocuments.js';
import type { WelcomeGame } from '../../src/welcome/welcomeDocuments.js';
import { logger } from '../../src/core/Logger.js';

/** The welcome against half-built and damaged documents: each reads as "nothing yet", never a throw. 2026-10-05. */
const GM = { id: 'gm', isGM: true };

describe('documents with parts missing', () => {
  it('lists nothing from a world with no users or actors', () => {
    const bare: WelcomeGame = { user: GM };
    expect(pendingRequests(bare)).toEqual([]);
    expect(actorMadeFor(bare, 'r1')).toBeNull();
    expect(ownCharacters(undefined)).toEqual([]);
  });

  it('skips a user with no flags or no id, and names an unnamed one', () => {
    const request = { id: 'r1', at: 1 };
    const game: WelcomeGame = {
      user: GM,
      users: {
        contents: [
          { id: 'u0' },
          { id: null, getFlag: () => request },
          { id: 'u1', getFlag: () => request },
        ],
      },
      actors: { contents: [{ id: 'a', uuid: 'Actor.a', name: null, type: 'character' }] },
    };
    expect(pendingRequests(game).map((user) => `${user.userId}:${user.userName}`)).toEqual([
      'u1:A player',
    ]);
    expect(actorMadeFor(game, 'r1')).toBeNull();
  });

  it('answers nobody when the user has gone', async () => {
    await expect(
      answerRequest({ user: GM }, 'u1', { kind: 'refused', requestId: 'r1', reason: 'no' })
    ).resolves.toBeUndefined();
  });
});

describe('a half-built sheet', () => {
  const boosts = (actor: GuideActor) =>
    guideSteps(actor).find((step) => step.key === 'boosts')?.done;

  it('counts slots and a key attribute with nothing listed as nothing to choose', () => {
    const actor: GuideActor = {
      ancestry: { name: 'Human', system: { boosts: { a: {} } } },
      background: { name: 'Acolyte' },
      class: { name: 'Fighter' },
      system: { build: { attributes: { boosts: { '1': [] } } } },
      gearCount: 0,
    };
    expect(boosts(actor)).toBe(true);
  });

  it('leaves boosts undone with no free boosts recorded at all', () => {
    expect(
      boosts({
        ancestry: { name: 'A' },
        background: { name: 'B' },
        class: { name: 'C' },
        gearCount: 0,
      })
    ).toBe(false);
  });
});

describe('the GM side when things fail', () => {
  it('answers with an empty uuid when Foundry made a sheet but gave no uuid', async () => {
    const answers: SheetResult[] = [];
    let pending = [
      {
        userId: 'u1',
        userName: 'M',
        request: { id: 'r1', name: 'T', partyUuid: null, at: 1, importBuild: null },
      },
    ];
    await new SheetRequests({
      isDesignatedGm: () => true,
      pending: () => pending,
      campaignParties: () => [{ uuid: 'Actor.P', name: 'P', code: 'C06' }],
      madeFor: () => null,
      create: async () => Promise.resolve({ kind: 'created', sheet: {} }),
      answer: async (_userId, result) => {
        answers.push(result);
        pending = [];
        return Promise.resolve();
      },
      tellGm: () => undefined,
    }).serve();
    expect(answers).toEqual([{ kind: 'created', requestId: 'r1', actorUuid: '' }]);
  });

  it('logs a pass that throws instead of losing it', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const settings = {
      register: vi.fn(),
      get: () => true,
      set: async () => Promise.reject(new Error('settings locked')),
    };
    /* A campaign party the shared setting does not hold yet, so the pass has to write it. */
    const party = { uuid: 'Actor.P', name: 'P', type: 'party', getFlag: () => 'C06' };
    const actors = Object.assign([party], { contents: [party] });
    const game = { user: GM, users: { activeGM: GM, contents: [] }, actors };
    startSheetRequests({ on: () => undefined }, settings, { game } as unknown as WelcomeGlobals);
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith('New player sheets failed: settings locked');
    });
    warn.mockRestore();
  });

  it('logs a failure that is not an Error, as text', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const settings = {
      register: vi.fn(),
      get: () => true,
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the case under test
      set: async () => Promise.reject('offline'),
    };
    const party = { uuid: 'Actor.P', name: 'P', type: 'party', getFlag: () => 'C06' };
    const actors = Object.assign([party], { contents: [party] });
    const game = { user: GM, users: { activeGM: GM, contents: [] }, actors };
    startSheetRequests({ on: () => undefined }, settings, { game } as unknown as WelcomeGlobals);
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith('New player sheets failed: offline');
    });
    warn.mockRestore();
  });
});
