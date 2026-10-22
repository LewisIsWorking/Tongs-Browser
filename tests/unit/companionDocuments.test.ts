import { describe, expect, it } from 'vitest';

import { companionListing, isCompanionSheet } from '../../src/welcome/companionDocuments.js';
import type { CompanionGame } from '../../src/welcome/companionDocuments.js';

/** The GM's listing of characters and the companions that exist. 2026-10-12. */
const flags =
  (values: Record<string, unknown>) =>
  (scope: string, key: string): unknown =>
    scope === 'tongs-browser' ? values[key] : undefined;

const items = (...slugs: (string | null)[]) => ({
  contents: slugs.map((slug, index) => (index % 2 === 0 ? { system: { slug } } : { slug })),
});

function game(actors: unknown[], isGM = true): CompanionGame {
  return {
    user: { isGM },
    users: {
      contents: [
        { id: 'gm', name: 'GM', isGM: true, role: 4 },
        { id: 'u1', name: 'Lai', role: 1 },
        { id: 'u0', name: 'Gone', role: 0 },
        { id: null, role: 1 },
        { id: 'u2', role: 1 },
      ],
    },
    actors: { contents: actors },
  } as unknown as CompanionGame;
}

describe("the GM's listing", () => {
  const kibwe = {
    id: 'A',
    uuid: 'Actor.A',
    name: 'Kibwe',
    type: 'character',
    ownership: { u1: 3, u0: 3, gm: 3, default: 0 },
    items: items('familiar', 'pet', null),
    getFlag: flags({ companionsMade: ['eidolon', 7] }),
  };

  it('lists characters a player owns, with their slugs, what Tongs made, and their folder', () => {
    const listing = companionListing(
      game([
        kibwe,
        { id: 'B', uuid: 'Actor.B', name: null, type: 'character', ownership: { gm: 3 } },
        { id: 'N', uuid: 'Actor.N', name: 'Wolf', type: 'npc', ownership: { u1: 3 } },
        {
          id: 'C',
          uuid: 'Actor.C',
          name: null,
          type: 'character',
          ownership: { u2: 3 },
          folder: { id: 'RIDDLEPORT' },
        },
      ])
    );
    expect(listing.characters).toEqual([
      {
        id: 'A',
        uuid: 'Actor.A',
        name: 'Kibwe',
        ownerIds: ['u1'],
        slugs: ['familiar', 'pet'],
        made: ['eidolon'],
        folderId: null,
      },
      {
        id: 'C',
        uuid: 'Actor.C',
        name: 'A character',
        ownerIds: ['u2'],
        slugs: [],
        made: [],
        folderId: 'RIDDLEPORT',
      },
    ]);
    expect([...listing.players]).toEqual([
      ['u1', 'Lai'],
      ['u2', 'A player'],
    ]);
  });

  it('lists the companions that exist: flagged, linked familiars, and hand-made ones', () => {
    const listing = companionListing(
      game([
        {
          id: 'F',
          uuid: 'Actor.F',
          type: 'character',
          ownership: { u1: 3 },
          getFlag: flags({ companionOf: 'Actor.A', companionKind: 'animal-companion' }),
        },
        {
          id: 'G',
          uuid: 'Actor.G',
          type: 'familiar',
          ownership: {},
          system: { master: { id: 'A' } },
        },
        { id: 'H', uuid: 'Actor.H', type: 'familiar', system: { master: { id: null } } },
        {
          id: 'E',
          uuid: 'Actor.E',
          type: 'character',
          ownership: { u1: 3 },
          ancestry: {
            flags: {
              core: { sourceId: 'Compendium.pf2e-animal-companions.sf-AC-Eidolons.Item.e' },
            },
          },
        },
        {
          id: 'K',
          uuid: 'Actor.K',
          type: 'character',
          ancestry: {
            _stats: {
              compendiumSource: 'Compendium.pf2e-animal-companions.AC-Construct-Companions.Item.k',
            },
          },
        },
        {
          id: 'W',
          uuid: 'Actor.W',
          type: 'character',
          ancestry: {
            _stats: {
              compendiumSource: 'Compendium.pf2e-animal-companions.AC-Ancestries-and-Class.Item.w',
            },
          },
        },
      ])
    );
    expect(listing.existing).toEqual([
      { of: 'Actor.A', ownerIds: ['u1'], kinds: ['animal-companion'] },
      { of: 'Actor.A', ownerIds: [], kinds: ['familiar', 'pet'] },
      { of: null, ownerIds: ['u1'], kinds: ['eidolon'] },
      { of: null, ownerIds: [], kinds: ['construct-companion'] },
      { of: null, ownerIds: [], kinds: ['animal-companion', 'undead-companion'] },
    ]);
    expect(listing.characters).toEqual([]);
  });

  it('lists nothing in a player browser', () => {
    const listing = companionListing(game([kibwe], false));
    expect(listing.characters).toEqual([]);
    expect(listing.players.size).toBe(0);
    expect(companionListing(undefined).existing).toEqual([]);
    const empty = companionListing({ user: { isGM: true } });
    expect(empty.characters).toEqual([]);
    const roleless = companionListing({
      user: { isGM: true },
      users: { contents: [{ id: 'u3', name: 'New' }] },
    });
    expect(roleless.players.size).toBe(0);
  });

  it('tells a companion sheet from a character', () => {
    expect(
      isCompanionSheet({ getFlag: flags({ companionOf: 'Actor.A', companionKind: 'pet' }) })
    ).toBe(true);
    expect(
      isCompanionSheet({
        ancestry: { _stats: { compendiumSource: 'Compendium.pf2e.ancestries.Item.d' } },
      })
    ).toBe(false);
    expect(isCompanionSheet({ ancestry: { _stats: { compendiumSource: 7 } } })).toBe(false);
    expect(isCompanionSheet({})).toBe(false);
  });
});
