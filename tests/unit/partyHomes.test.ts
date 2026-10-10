import { describe, expect, it, vi } from 'vitest';

import { PartyHomes, homeless } from '../../src/welcome/PartyHomes.js';
import type { PartyHomePorts } from '../../src/welcome/PartyHomes.js';
import { homeListing } from '../../src/welcome/welcomeDocuments.js';
import type { HomeListing, WelcomeGame } from '../../src/welcome/welcomeDocuments.js';

/**
 * A player's sheet that is in no party, put in the campaign's party. 2026-10-10.
 *
 * Found live in C07: Livy was copied in, not made by the welcome, so "The Party" read "No Members".
 */
const sheet = (uuid: string, ownerIds: string[], joined = false) => ({
  uuid,
  name: uuid.slice(6),
  ownerIds,
  joined,
});
const listing = (characters: HomeListing['characters']): HomeListing => ({
  players: [
    { id: 'antoine', name: 'MrNegetZ' },
    { id: 'ryo', name: 'Ryo' },
  ],
  characters,
});
const party = { uuid: 'Actor.P', name: 'The Party', code: '', primary: true };

describe('which sheets have no home', () => {
  it("is a player's one sheet outside a party", () => {
    expect(homeless(listing([sheet('Actor.Livy', ['antoine'])]), new Set())).toEqual([
      { sheetUuid: 'Actor.Livy', sheetName: 'Livy', playerName: 'MrNegetZ' },
    ]);
  });

  it('is nothing for a player already in a party, or with several loose sheets to choose from', () => {
    const inParty = listing([sheet('Actor.Old', ['antoine']), sheet('Actor.New', ['antoine'])]);
    expect(homeless(inParty, new Set(['Actor.New']))).toEqual([]);
    const several = listing([sheet('Actor.A', ['ryo']), sheet('Actor.B', ['ryo'])]);
    expect(homeless(several, new Set())).toEqual([]);
  });

  it('is nothing for a sheet Tongs already added once, or owned by nobody at the table', () => {
    expect(homeless(listing([sheet('Actor.Livy', ['antoine'], true)]), new Set())).toEqual([]);
    expect(homeless(listing([sheet('Actor.Npc', ['gm'])]), new Set())).toEqual([]);
  });

  it('names a sheet two players share once', () => {
    const shared = listing([sheet('Actor.Duo', ['antoine', 'ryo'])]);
    expect(homeless(shared, new Set())).toHaveLength(1);
  });
});

function homes(overrides: Partial<PartyHomePorts> = {}) {
  const told: string[] = [];
  const ports: PartyHomePorts = {
    isDesignatedGm: () => true,
    campaignParties: () => [party],
    listing: () => listing([sheet('Actor.Livy', ['antoine'])]),
    members: () => new Set(),
    join: vi.fn(async () => Promise.resolve()),
    markJoined: vi.fn(async () => Promise.resolve()),
    tellGm: (text) => told.push(text),
    ...overrides,
  };
  return { homes: new PartyHomes(ports), ports, told };
}

describe('the GM side', () => {
  it('adds the sheet to the one campaign party, marks it, and tells the GM', async () => {
    const { homes: h, ports, told } = homes();
    await h.serve();
    expect(ports.join).toHaveBeenCalledWith('Actor.P', 'Actor.Livy');
    expect(ports.markJoined).toHaveBeenCalledWith('Actor.Livy', 'Actor.P');
    expect(told).toEqual(["Tongs added MrNegetZ's Livy to The Party."]);
  });

  it('does nothing in a world with several campaign parties, or none, or for another GM', async () => {
    const two = [
      { uuid: 'Actor.A', name: 'C00', code: 'C00' },
      { uuid: 'Actor.B', name: 'C01', code: 'C01' },
    ];
    for (const overrides of [
      { campaignParties: () => two },
      { campaignParties: () => [] },
      { isDesignatedGm: () => false },
    ]) {
      const { homes: h, ports } = homes(overrides);
      await h.serve();
      expect(ports.join).not.toHaveBeenCalled();
    }
  });

  it('marks a sheet it could not add, so the GM is told once, not on every update', async () => {
    const { homes: h, ports, told } = homes({
      join: vi.fn(async () => Promise.reject(new Error('That party cannot take members.'))),
      markJoined: vi.fn(async () => Promise.reject(new Error('offline'))),
    });
    await h.serve();
    expect(ports.markJoined).toHaveBeenCalledWith('Actor.Livy', 'Actor.P');
    expect(told).toEqual([
      "Tongs could not add MrNegetZ's Livy to The Party: That party cannot take members.",
    ]);
    const { homes: odd, told: oddTold } = homes({
      join: vi.fn(async () => Promise.reject('no')),
    });
    await odd.serve();
    expect(oddTold).toEqual(["Tongs could not add MrNegetZ's Livy to The Party: no"]);
  });

  it('runs one pass at a time: a call mid-pass becomes one more pass', async () => {
    let release = (): void => undefined;
    const join = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    const { homes: h } = homes({ join });
    const first = h.serve();
    await h.serve();
    await h.serve();
    release();
    await vi.waitFor(() => {
      expect(join).toHaveBeenCalledTimes(2);
    });
    release();
    await first;
    expect(join).toHaveBeenCalledTimes(2);
  });
});

describe('the listing', () => {
  it('lists active players and every character with its owners, for a GM only', () => {
    const flags = (joined: boolean) => (_scope: string, key: string) =>
      joined && key === 'joinedParty' ? 'Actor.P' : undefined;
    const game = {
      user: { id: 'gm', isGM: true },
      users: {
        contents: [
          { id: 'gm', isGM: true, role: 4 },
          { id: 'antoine', name: 'MrNegetZ', role: 1 },
          { id: 'gone', name: 'Disabled', role: 0 },
          { id: 'anon', role: 1 },
          { id: null, role: 1 },
        ],
      },
      actors: {
        contents: [
          {
            id: 'L',
            uuid: 'Actor.L',
            name: 'Livy',
            type: 'character',
            ownership: { default: 0, antoine: 3, gm: 2 },
            getFlag: flags(false),
          },
          { id: 'J', uuid: 'Actor.J', name: null, type: 'character', getFlag: flags(true) },
          { id: 'P', uuid: 'Actor.P', name: 'The Party', type: 'party' },
        ],
      },
    } as unknown as WelcomeGame;

    expect(homeListing(game)).toEqual({
      players: [
        { id: 'antoine', name: 'MrNegetZ' },
        { id: 'anon', name: 'A player' },
      ],
      characters: [
        { uuid: 'Actor.L', name: 'Livy', ownerIds: ['antoine'], joined: false },
        { uuid: 'Actor.J', name: 'A sheet', ownerIds: [], joined: true },
      ],
    });
    expect(homeListing({ ...game, user: { id: 'antoine', isGM: false } })).toEqual({
      players: [],
      characters: [],
    });
    expect(homeListing(undefined)).toEqual({ players: [], characters: [] });
    expect(homeListing({ user: { id: 'gm', isGM: true } })).toEqual({
      players: [],
      characters: [],
    });
  });
});
