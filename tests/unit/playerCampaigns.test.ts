import { describe, expect, it, vi } from 'vitest';

import { MODULE_ID } from '../../src/constants.js';
import { offeredParties, pickParty } from '../../src/welcome/campaignParty.js';
import { PartyHomes } from '../../src/welcome/PartyHomes.js';
import type { PartyHomePorts } from '../../src/welcome/PartyHomes.js';
import {
  PLAYER_CAMPAIGNS_SETTING,
  campaignsOf,
  readPlayerCampaigns,
  registerPlayerCampaigns,
  storePlayerCampaigns,
} from '../../src/welcome/playerCampaigns.js';
import type { CampaignSettings } from '../../src/welcome/playerCampaigns.js';
import { SheetRequests } from '../../src/welcome/SheetRequests.js';
import type { SheetRequestPorts } from '../../src/welcome/SheetRequests.js';
import { WorldSwapGm } from '../../src/swaps/WorldSwapGm.js';

/**
 * The party of the campaign a player posts in, where two campaigns share a world. 2026-10-10.
 *
 * Lewis: "if you've messaged C01 CHAT then you should get sheet in the C01 party, likewise with C00".
 */
const ANN = 'AnnAnnAnnAnnAnn1';
const BOB = 'BobBobBobBobBob2';
const C00 = { uuid: 'Actor.R', name: 'Riddleport', code: 'C00' };
const C01 = { uuid: 'Actor.D', name: 'Doomsday', code: 'C01' };
const both = [C00, C01];

function settingsHolding(value: unknown) {
  let stored = value;
  const settings: CampaignSettings = {
    register: vi.fn(),
    get: () => stored,
    set: vi.fn(async (_namespace: string, _key: string, next: unknown) => {
      stored = next;
      return Promise.resolve(next);
    }),
  };
  return settings;
}

describe('what COO said', () => {
  it('keeps Foundry ids with real campaign codes, and nothing else', () => {
    expect(
      readPlayerCampaigns({
        [ANN]: ['c01', 'C00', 'C01', 'nope!'],
        [BOB]: [],
        short: ['C00'],
        x: 'C00',
      })
    ).toEqual({ [ANN]: ['C00', 'C01'] });
    expect(readPlayerCampaigns(null)).toEqual({});
    expect(readPlayerCampaigns([ANN])).toEqual({});
  });

  it('is a hidden world setting, read per player', () => {
    const settings = settingsHolding({ [ANN]: ['C01'] });
    registerPlayerCampaigns(settings);
    expect(settings.register).toHaveBeenCalledWith(
      MODULE_ID,
      PLAYER_CAMPAIGNS_SETTING,
      expect.objectContaining({ scope: 'world', config: false })
    );
    expect(campaignsOf(settings, ANN)).toEqual(['C01']);
    expect(campaignsOf(settings, BOB)).toEqual([]);
  });

  it('is written only when it changed', async () => {
    const settings = settingsHolding({ [ANN]: ['C01'] });
    await storePlayerCampaigns(settings, { [ANN]: ['c01'] });
    expect(settings.set).not.toHaveBeenCalled();
    await storePlayerCampaigns(settings, { [ANN]: ['C00'] });
    expect(settings.set).toHaveBeenCalledWith(MODULE_ID, PLAYER_CAMPAIGNS_SETTING, {
      [ANN]: ['C00'],
    });
  });
});

describe('picking the party', () => {
  it("takes the player's own campaign's party when two share a world", () => {
    expect(pickParty(null, both, ['C01'])).toEqual({ kind: 'party', party: C01 });
  });

  it('still asks when the player posts in both, or in neither', () => {
    expect(pickParty(null, both, ['C00', 'C01']).kind).toBe('ambiguous');
    expect(pickParty(null, both, ['C07']).kind).toBe('ambiguous');
    expect(pickParty(null, both).kind).toBe('ambiguous');
  });

  it("offers a player only their own campaign's party, or every party when that is unclear", () => {
    expect(offeredParties(both, ['C00'])).toEqual([C00]);
    expect(offeredParties(both, ['C00', 'C01'])).toEqual(both);
    expect(offeredParties(both, [])).toEqual(both);
  });
});

describe('the GM side', () => {
  it("makes a requested sheet in the requester's campaign party", async () => {
    const created: string[] = [];
    const ports: SheetRequestPorts = {
      isDesignatedGm: () => true,
      pending: () =>
        created.length > 0
          ? []
          : [
              {
                userId: BOB,
                userName: 'Bob',
                request: { id: 'r1', name: 'Vex', partyUuid: null, at: 1, importBuild: null },
              },
            ],
      campaignParties: () => both,
      campaignsOf: (userId) => (userId === BOB ? ['C01'] : []),
      madeFor: () => null,
      create: async (sheet) => {
        created.push(`${sheet.name}:${sheet.partyUuid}`);
        return Promise.resolve({ kind: 'created', sheet: { uuid: 'Actor.NEW' } });
      },
      answer: async () => Promise.resolve(),
      tellGm: () => undefined,
    };
    await new SheetRequests(ports).serve();
    expect(created).toEqual(['Vex:Actor.D']);
  });

  it("adds each loose sheet to its own player's campaign party, and skips one it cannot place", async () => {
    const joined: string[] = [];
    const ports: PartyHomePorts = {
      isDesignatedGm: () => true,
      campaignParties: () => both,
      campaignsOf: (userId) => (userId === ANN ? ['C00'] : []),
      listing: () => ({
        players: [
          { id: ANN, name: 'Ann' },
          { id: BOB, name: 'Bob' },
        ],
        characters: [
          { uuid: 'Actor.A', name: 'A', ownerIds: [ANN], joined: false },
          { uuid: 'Actor.B', name: 'B', ownerIds: [BOB], joined: false },
        ],
      }),
      members: () => new Set(),
      join: async (party, sheet) => {
        joined.push(`${sheet}:${party}`);
        return Promise.resolve();
      },
      markJoined: async () => Promise.resolve(),
      tellGm: () => undefined,
    };
    await new PartyHomes(ports).serve();
    expect(joined).toEqual(['Actor.A:Actor.R']);
  });

  it("stores the heartbeat's playerCampaigns", async () => {
    const campaigns = vi.fn(async () => Promise.resolve());
    const map = { [ANN]: ['C00'] };
    const gm = new WorldSwapGm({
      isGm: () => true,
      worldId: () => 'doomsday-funtime',
      call: async () =>
        Promise.resolve({
          status: 200,
          json: async () => Promise.resolve({ pending: [], playerCampaigns: map }),
        }),
      ask: async () => Promise.resolve(true),
      notify: () => undefined,
      campaigns,
    });
    await gm.beat();
    expect(campaigns).toHaveBeenCalledWith(map);
  });
});
