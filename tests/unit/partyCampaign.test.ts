import { describe, expect, it, vi } from 'vitest';

import { BandReporter } from '../../src/bands/BandReporter.js';
import type { BandPorts } from '../../src/bands/BandReporter.js';
import { combatCampaign } from '../../src/bands/combatCampaign.js';
import {
  campaignForCombat,
  campaignProblem,
  normalizeCampaign,
} from '../../src/bands/partyCampaign.js';
import type { CampaignChoice } from '../../src/bands/partyCampaign.js';
import { readPartyCampaigns } from '../../src/foundry/PartyAccess.js';
import type { PartyCampaignEntry } from '../../src/foundry/PartyAccess.js';

/**
 * Which campaign a combat belongs to, when several campaigns share one world. Written 2026-09-15.
 */
let next = 0;
/** A player character, and the parties that list it, each with its campaign code. */
const pc = (...codes: unknown[]) => {
  next += 1;
  const uuid = `Actor.PC${String(next)}`;
  return {
    combatant: { actor: { uuid, type: 'character', hasPlayerOwner: true } },
    parties: codes.map((campaign, index) => ({
      uuid: `Actor.Party${String(next)}-${String(index)}`,
      name: 'P',
      campaign,
      members: [uuid],
    })),
  };
};
const combat = (...members: ({ combatant: object; parties: PartyCampaignEntry[] } | object)[]) => {
  const parties = members.flatMap((m) => ('parties' in m ? m.parties : []));
  const combatants = members.map((m) => ('combatant' in m ? m.combatant : m));
  return [{ game: { combat: { combatants: { contents: combatants } } } }, parties] as const;
};

describe('the campaign of a combat', () => {
  it("is the one campaign its player characters' parties share", () => {
    expect(combatCampaign(...combat(pc('C06'), pc('c06 '), { actor: null }))).toEqual({
      kind: 'one',
      code: 'C06',
    });
  });

  it('is nothing when no party is coded, and mixed when two campaigns fight together', () => {
    expect(combatCampaign(...combat(pc(), pc(''), pc('not a code!')))).toEqual({ kind: 'none' });
    expect(combatCampaign(...combat(pc('C06'), pc('C04')))).toEqual({
      kind: 'mixed',
      codes: ['C04', 'C06'],
    });
    expect(combatCampaign(...combat(pc('C06', 'C07')))).toEqual({
      kind: 'mixed',
      codes: ['C06', 'C07'],
    });
    expect(combatCampaign({ game: { combat: null } }, [])).toEqual({ kind: 'none' });
  });

  it('counts only player characters: not enemies, not a player-owned companion, not an unowned or uuid-less PC', () => {
    const listed = (actor: object) => ({
      combatant: { actor },
      parties: [
        { uuid: 'Actor.X', name: 'X', campaign: 'C04', members: ['Actor.E', 'Actor.F', 'Actor.U'] },
      ],
    });
    const enemy = listed({ uuid: 'Actor.E', type: 'npc', hasPlayerOwner: false });
    const companion = listed({ uuid: 'Actor.F', type: 'familiar', hasPlayerOwner: true });
    const unowned = listed({ uuid: 'Actor.U', type: 'character', hasPlayerOwner: false });
    const noUuid = { actor: { type: 'character', hasPlayerOwner: true } };
    expect(combatCampaign(...combat(pc('C06'), enemy, companion, unowned, noUuid))).toEqual({
      kind: 'one',
      code: 'C06',
    });
  });

  /* ⛔ Found live: PF2e leaves a brand-new party out of its members' `actor.parties`. */
  it("finds a character through the party's own member list, whatever actor.parties says", () => {
    const character = {
      uuid: 'Actor.Lai',
      type: 'character',
      hasPlayerOwner: true,
      parties: new Set(),
    };
    const newParty: PartyCampaignEntry = {
      uuid: 'Actor.Kibwe',
      name: 'Kibwe',
      campaign: 'C06',
      members: ['Actor.Lai'],
    };
    expect(
      combatCampaign({ game: { combat: { combatants: { contents: [{ actor: character }] } } } }, [
        newParty,
      ])
    ).toEqual({ kind: 'one', code: 'C06' });
  });

  it('reads codes the way config.json writes them, and explains a combat it cannot place', () => {
    expect(normalizeCampaign(' c09')).toBe('C09');
    expect(normalizeCampaign(9)).toBe('');
    expect(normalizeCampaign('C 06')).toBe('');
    expect(normalizeCampaign('Kibwe')).toBe('');
    expect(campaignForCombat([])).toEqual({ kind: 'none' });
    expect(campaignProblem({ kind: 'one', code: 'C06' })).toBeNull();
    expect(campaignProblem({ kind: 'none' })).toContain('Party campaigns');
    expect(campaignProblem({ kind: 'mixed', codes: ['C04', 'C06'] })).toContain('C04 and C06');
  });
});

describe('listing party campaigns', () => {
  const actor = (type: string, name: string | undefined, code: unknown) => ({
    type,
    name,
    uuid: name === undefined ? undefined : `Actor.${name}`,
    getFlag: (_scope: string, key: string) => (key === 'bandsCampaign' ? code : undefined),
    system: { details: { members: [{ uuid: 'Actor.Lai' }, { uuid: 7 }] } },
  });

  it('gives a GM every party with its flag, and a player nothing', () => {
    const actors = [
      actor('party', 'Kibwe', 'C06'),
      actor('character', 'Lai', 'C06'),
      actor('party', undefined, 'C04'),
    ];
    expect(
      readPartyCampaigns({ getGame: () => ({ actors: actors as never, user: { isGM: true } }) })
    ).toEqual([{ uuid: 'Actor.Kibwe', name: 'Kibwe', campaign: 'C06', members: ['Actor.Lai'] }]);
    expect(
      readPartyCampaigns({ getGame: () => ({ actors: actors as never, user: { isGM: false } }) })
    ).toEqual([]);
    expect(readPartyCampaigns({ getGame: () => undefined })).toEqual([]);
  });
});

describe('a combat the reporter cannot place', () => {
  it('posts nothing, warns once per problem, and warns again after a post gets through', async () => {
    let choice: CampaignChoice = { kind: 'none' };
    let hp = 28;
    const posts: string[] = [];
    const ports: BandPorts = {
      role: () => 'act',
      campaign: () => choice,
      subjectsFor: () => [
        {
          tokenUuid: 'T',
          name: 'Goblin',
          segments: Math.ceil((hp * 10) / 28),
          word: 'w',
          hp,
          maxHp: 28,
        },
      ],
      combatSubjects: () => [],
      post: (campaign) => {
        posts.push(campaign);
        return Promise.resolve('sent');
      },
      causeFor: () => Promise.resolve('manual change'),
      warn: vi.fn(),
    };
    const reporter = new BandReporter(ports);
    const hit = async (next: CampaignChoice) => {
      choice = next;
      hp -= 1;
      await reporter.onActorUpdated({}, { system: { attributes: { hp: { value: hp } } } });
    };

    await hit({ kind: 'none' });
    await hit({ kind: 'none' });
    await hit({ kind: 'mixed', codes: ['C04', 'C06'] });
    await hit({ kind: 'one', code: 'C06' });
    await hit({ kind: 'none' });

    expect(posts).toEqual(['C06']);
    expect(
      vi
        .mocked(ports.warn)
        .mock.calls.map(([message]) => (message.includes('C04') ? 'mixed' : 'none'))
    ).toEqual(['none', 'mixed', 'none']);
  });
});
