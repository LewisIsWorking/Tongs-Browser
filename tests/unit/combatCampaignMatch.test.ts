import { describe, expect, it } from 'vitest';

import { combatCampaign } from '../../src/bands/combatCampaign.js';
import { campaignProblem } from '../../src/bands/partyCampaign.js';
import type { PartyCampaignEntry } from '../../src/foundry/PartyAccess.js';

/**
 * Found live on Forge, 2026-09-15: a player's strike was applied, and the band was not posted with
 * "no party in this combat has a Path Wars campaign" while ten parties had one.
 */
const kibwe: PartyCampaignEntry = {
  uuid: 'Actor.Kibwe',
  name: 'Kibwe',
  campaign: 'C06',
  members: ['Actor.Changer'],
};
const inCombat = (...combatants: object[]) => ({ combatants: { contents: combatants } });
const character = (uuid: string, name = 'Changer') => ({
  uuid,
  name,
  type: 'character',
  hasPlayerOwner: true,
});

describe('placing a combat whose character token is not linked to its actor', () => {
  it("matches the character by its token's base actor, not the synthetic actor's uuid", () => {
    const unlinked = {
      actor: character('Scene.S.Token.T.Actor.Changer'),
      token: { baseActor: { uuid: 'Actor.Changer' } },
    };
    expect(combatCampaign(inCombat(unlinked), [kibwe])).toEqual({ kind: 'one', code: 'C06' });
  });

  it("falls back to the actor's own uuid when the token has no base actor", () => {
    const orphan = { actor: character('Actor.Changer'), token: { baseActor: null } };
    expect(combatCampaign(inCombat(orphan), [kibwe])).toEqual({ kind: 'one', code: 'C06' });
  });
});

describe('telling the GM which characters could not be placed', () => {
  it('names every player character when none is in a coded party', () => {
    const choice = combatCampaign(
      inCombat(
        { actor: character('Actor.Changer') },
        { actor: character('Actor.Ryo', 'Ryo') },
        { actor: { uuid: 'Actor.Goblin', name: 'Goblin', type: 'npc', hasPlayerOwner: false } }
      ),
      [{ ...kibwe, campaign: '' }]
    );
    expect(choice).toEqual({ kind: 'none', characters: ['Changer', 'Ryo'] });
    expect(campaignProblem(choice)).toContain('lists Changer, Ryo.');
  });

  it('says so when the combat has no player character at all', () => {
    const choice = combatCampaign(
      inCombat({ actor: { type: 'character', hasPlayerOwner: true } }),
      []
    );
    expect(choice).toEqual({ kind: 'none', characters: ['an unnamed character'] });
    expect(campaignProblem({ kind: 'none', characters: [] })).toContain('no player character');
  });
});
