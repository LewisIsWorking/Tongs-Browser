import { describe, expect, it, vi } from 'vitest';

import { PartyHomes, homeless } from '../../src/welcome/PartyHomes.js';
import type { PartyHomePorts } from '../../src/welcome/PartyHomes.js';
import { homeListing } from '../../src/welcome/welcomeDocuments.js';
import type { HomeListing, WelcomeGame } from '../../src/welcome/welcomeDocuments.js';

/**
 * A blank welcome sheet is not a seat at the table (2026-10-11). Anthony: "for people that already had a sheet it
 * seems to import it successfully but not put it in the party sheet". Lai and Ryo each had a blank sheet in
 * "The Party", so the character they brought in was left out.
 */
const sheet = (uuid: string, placeholder = false, joined = false) => ({
  uuid,
  name: uuid.slice(6),
  ownerIds: ['lai'],
  joined,
  placeholder,
});
const listing = (characters: HomeListing['characters']): HomeListing => ({
  players: [{ id: 'lai', name: 'Lai' }],
  characters,
});

describe('a blank welcome sheet in the party', () => {
  it('makes way for the one real sheet the player brought', () => {
    const lai = listing([sheet('Actor.Blank', true), sheet('Actor.Kibwe')]);
    expect(homeless(lai, new Set(['Actor.Blank']))).toEqual([
      {
        playerId: 'lai',
        sheetUuid: 'Actor.Kibwe',
        sheetName: 'Kibwe',
        playerName: 'Lai',
        replaces: ['Actor.Blank'],
      },
    ]);
  });

  it('stays when the player has no real sheet, or two to choose between, or a real one already seated', () => {
    expect(homeless(listing([sheet('Actor.Blank', true)]), new Set(['Actor.Blank']))).toEqual([]);
    const two = listing([sheet('Actor.Blank', true), sheet('Actor.A'), sheet('Actor.B')]);
    expect(homeless(two, new Set(['Actor.Blank']))).toEqual([]);
    const seated = listing([sheet('Actor.Blank', true), sheet('Actor.A'), sheet('Actor.B')]);
    expect(homeless(seated, new Set(['Actor.Blank', 'Actor.A']))).toEqual([]);
  });

  it('still lets a blank sheet made outside every party join, as before', () => {
    expect(homeless(listing([sheet('Actor.Blank', true)]), new Set())).toHaveLength(1);
  });

  it('never re-adds a real sheet a GM took out', () => {
    const out = listing([sheet('Actor.Blank', true), sheet('Actor.Kibwe', false, true)]);
    expect(homeless(out, new Set(['Actor.Blank']))).toEqual([]);
  });
});

describe('the GM side, swapping', () => {
  it('adds the real sheet, then takes the blank one out of the party, and says so', async () => {
    const told: string[] = [];
    const order: string[] = [];
    const ports: PartyHomePorts = {
      isDesignatedGm: () => true,
      campaignParties: () => [{ uuid: 'Actor.P', name: 'The Party', code: '', primary: true }],
      listing: () => listing([sheet('Actor.Blank', true), sheet('Actor.Kibwe')]),
      members: () => new Set(['Actor.Blank']),
      join: vi.fn(async (_party: string, uuid: string) => {
        order.push(`join ${uuid}`);
        return Promise.resolve();
      }),
      leave: vi.fn(async (uuid: string) => {
        order.push(`leave ${uuid}`);
        return Promise.resolve();
      }),
      markJoined: vi.fn(async () => Promise.resolve()),
      tellGm: (text) => told.push(text),
    };
    await new PartyHomes(ports).serve();
    expect(order).toEqual(['join Actor.Kibwe', 'leave Actor.Blank']);
    expect(told).toEqual([
      "Tongs added Lai's Kibwe to The Party in place of their blank welcome sheet.",
    ]);
  });
});

describe('which sheets the listing calls blank', () => {
  it('is a welcome sheet with no ancestry, no class and no import on its way', () => {
    const flags =
      (made: boolean, importing = false) =>
      (_scope: string, key: string) =>
        (made && key === 'madeForRequest') || (importing && key === 'importBuild')
          ? 'x'
          : undefined;
    const actor = (id: string, extra: object) => ({
      id,
      uuid: `Actor.${id}`,
      name: id,
      type: 'character',
      ownership: { lai: 3 },
      ...extra,
    });
    const game = {
      user: { id: 'gm', isGM: true },
      users: { contents: [{ id: 'lai', name: 'Lai', role: 1 }] },
      actors: {
        contents: [
          actor('Blank', { getFlag: flags(true) }),
          actor('Built', { getFlag: flags(true), ancestry: { name: 'Dwarf' } }),
          actor('Classed', { getFlag: flags(true), class: { name: 'Fighter' } }),
          actor('Importing', { getFlag: flags(true, true) }),
          actor('Copied', { getFlag: flags(false) }),
          actor('NoFlags', {}),
        ],
      },
    } as unknown as WelcomeGame;
    expect(homeListing(game).characters.map((each) => [each.name, each.placeholder])).toEqual([
      ['Blank', true],
      ['Built', false],
      ['Classed', false],
      ['Importing', false],
      ['Copied', false],
      ['NoFlags', false],
    ]);
  });
});
