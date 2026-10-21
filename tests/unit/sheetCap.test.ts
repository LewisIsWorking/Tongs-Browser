import { describe, expect, it } from 'vitest';

import { SheetRequests } from '../../src/welcome/SheetRequests.js';
import type { SheetRequestPorts } from '../../src/welcome/SheetRequests.js';
import type { SheetResult } from '../../src/welcome/sheetRequest.js';
import {
  countedCharacters,
  countedSheetsFor,
  homeListing,
} from '../../src/welcome/welcomeDocuments.js';
import type { WelcomeGame } from '../../src/welcome/welcomeDocuments.js';

/**
 * The sheet cap, enforced by the GM's browser. 2026-10-12.
 *
 * Lewis, 2026-10-21: every player gets one sheet; /extrasheet makes it 2, and 2 is the most. Companion and
 * familiar classes add nothing, and companion sheets never count.
 */
const PARTY = { uuid: 'Actor.P', name: 'The Party', code: 'C06' };

function world(count: { owned: number; allowed: number; extra?: number }) {
  const answers: SheetResult[] = [];
  const told: string[] = [];
  const created: string[] = [];
  const ports: SheetRequestPorts = {
    isDesignatedGm: () => true,
    pending: () =>
      answers.length > 0
        ? []
        : [
            {
              userId: 'u1',
              userName: 'Lai',
              request: { id: 'r2', name: 'Kibwe', partyUuid: null, at: 1, importBuild: null },
            },
          ],
    campaignParties: () => [PARTY],
    madeFor: () => null,
    sheetCount: () => count,
    create: async (sheet) => {
      created.push(sheet.name);
      return Promise.resolve({ kind: 'created', sheet: { uuid: 'Actor.NEW' } });
    },
    answer: async (_userId, result) => {
      answers.push(result);
      return Promise.resolve();
    },
    tellGm: (text) => told.push(text),
  };
  return { requests: new SheetRequests(ports), answers, told, created };
}

describe('the cap', () => {
  it('turns down a second sheet without a grant, saying how to get one', async () => {
    const { requests, answers, created, told } = world({ owned: 1, allowed: 1, extra: 0 });
    await requests.serve();
    expect(created).toEqual([]);
    expect(answers).toEqual([
      {
        kind: 'refused',
        requestId: 'r2',
        reason:
          "You already have a character sheet here. For a second one, send /extrasheet in your campaign's Telegram topic.",
      },
    ]);
    expect(told).toEqual([
      'Lai asked for another character, but already has 1 of the 1 they may have here.',
    ]);
  });

  it('makes a second sheet, in the party, for a player with a /extrasheet grant', async () => {
    const { requests, answers, created, told } = world({ owned: 1, allowed: 2, extra: 1 });
    await requests.serve();
    expect(created).toEqual(['Kibwe']);
    expect(answers[0]).toMatchObject({ kind: 'created' });
    expect(told).toEqual(['Tongs made Kibwe for Lai, in The Party.']);
  });

  it('turns down a third sheet, with no hint once the grant is used', async () => {
    const { requests, answers, created, told } = world({ owned: 2, allowed: 2, extra: 1 });
    await requests.serve();
    expect(created).toEqual([]);
    expect(answers[0]).toMatchObject({
      kind: 'refused',
      reason: 'You already have 2 character sheets here, which is the most anyone can have.',
    });
    expect(told).toEqual([
      'Lai asked for another character, but already has 2 of the 2 they may have here.',
    ]);
  });

  it('makes the first sheet as before', async () => {
    const { requests, created } = world({ owned: 0, allowed: 1 });
    await requests.serve();
    expect(created).toEqual(['Kibwe']);
  });
});

const flags =
  (values: Record<string, unknown>) =>
  (scope: string, key: string): unknown =>
    scope === 'tongs-browser' ? values[key] : undefined;

const sheet = (uuid: string, extra: Record<string, unknown> = {}) => ({
  id: uuid.slice(6),
  uuid,
  name: uuid,
  type: 'character',
  isOwner: true,
  ownership: { u1: 3 },
  getFlag: flags({}),
  ...extra,
});

const companion = sheet('Actor.FAM', {
  getFlag: flags({ companionOf: 'Actor.A', companionKind: 'animal-companion' }),
});
const handMade = sheet('Actor.HAND', {
  ancestry: {
    _stats: { compendiumSource: 'Compendium.pf2e-animal-companions.AC-Eidolons.Item.x' },
  },
});

function gameWith(actors: unknown[], isGM = true): WelcomeGame {
  return {
    user: { id: isGM ? 'gm' : 'u1', isGM },
    users: { contents: [{ id: 'u1', name: 'Lai', role: 1 }] },
    actors: { contents: actors },
  } as unknown as WelcomeGame;
}

describe('what counts', () => {
  it("counts a player's character sheets, never a companion's", () => {
    const game = gameWith([
      sheet('Actor.A'),
      companion,
      handMade,
      sheet('Actor.O', { ownership: { u2: 3 } }),
    ]);
    expect(countedSheetsFor(game, 'u1')).toHaveLength(1);
    expect(countedSheetsFor(gameWith([sheet('Actor.A')], false), 'u1')).toHaveLength(0);
    expect(countedSheetsFor({ user: { id: 'gm', isGM: true } }, 'u1')).toHaveLength(0);
    expect(
      countedCharacters(gameWith([sheet('Actor.A'), companion, handMade])).map((a) => a.uuid)
    ).toEqual(['Actor.A']);
  });

  it("leaves companions out of PartyHomes' listing", () => {
    const listing = homeListing(gameWith([sheet('Actor.A'), companion, handMade]));
    expect(listing.characters.map((each) => each.uuid)).toEqual(['Actor.A']);
  });
});
