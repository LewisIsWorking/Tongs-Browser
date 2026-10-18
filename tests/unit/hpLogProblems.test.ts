import { describe, expect, it } from 'vitest';

import { HpLogReporter } from '../../src/bands/HpLogReporter.js';
import type { HpLogOutcome } from '../../src/bands/HpLogReporter.js';
import type { CampaignChoice } from '../../src/bands/partyCampaign.js';
import { buildHpLog, campaignOfCharacter } from '../../src/bands/startHpLog.js';

/** What the GM is told when an HP change cannot be recorded, and odd actors. Added 2026-10-17. */
const lorn = (hp: number) => ({
  id: 'lorn',
  uuid: 'Actor.lorn',
  name: 'Lorn',
  type: 'character',
  system: { attributes: { hp: { value: hp, max: 52 } } },
});

const reporter = (choice: CampaignChoice, post: () => Promise<HpLogOutcome>) => {
  const warnings: string[] = [];
  const log = new HpLogReporter({
    role: () => 'act',
    actors: () => [],
    campaignOf: () => choice,
    post,
    causeFor: () => Promise.resolve({ gm: 'manual change', shown: null }),
    warn: (message) => warnings.push(message),
    now: () => 0,
  });
  const hurt = async (hp: number) =>
    log.onActorUpdated(lorn(hp), { system: { attributes: { hp: { value: hp } } } });
  return { warnings, hurt };
};

describe('an HP change that cannot be recorded', () => {
  it('names both campaigns when the character is in two', async () => {
    const { warnings, hurt } = reporter({ kind: 'mixed', codes: ['C04', 'C06'] }, () =>
      Promise.resolve('sent')
    );

    await hurt(40);

    expect(warnings).toEqual([
      "Tongs Browser did not record Lorn's HP change: their parties are in C04 and C06, so it cannot tell which campaign it belongs to.",
    ]);
  });

  it('tells the GM every time a post fails or throws', async () => {
    let calls = 0;
    const { warnings, hurt } = reporter({ kind: 'one', code: 'C06' }, () =>
      ++calls === 1 ? Promise.resolve('failed') : Promise.reject(new Error('offline'))
    );

    await hurt(40);
    await hurt(30);

    expect(warnings).toEqual([
      'Tongs Browser could not record the HP change of Lorn.',
      'Tongs Browser could not record the HP change of Lorn.',
    ]);
  });

  it("says nothing more when signed out: the sign-in warning is the client's", async () => {
    const { warnings, hurt } = reporter({ kind: 'one', code: 'C06' }, () =>
      Promise.resolve('signed-out')
    );

    await hurt(40);

    expect(warnings).toEqual([]);
  });

  it('records an actor with no id or name under its uuid and a placeholder name', async () => {
    const posts: unknown[] = [];
    const log = new HpLogReporter({
      role: () => 'act',
      actors: () => [],
      campaignOf: () => ({ kind: 'one', code: 'C06' }),
      post: (_code, change) => {
        posts.push(change);
        return Promise.resolve('sent');
      },
      causeFor: () => Promise.resolve({ gm: 'manual change', shown: null }),
      warn: () => undefined,
      now: () => 0,
    });
    const odd = { ...lorn(10), id: undefined, name: undefined };

    await log.onActorUpdated(odd, { system: { attributes: { hp: { value: 10 } } } });

    expect(posts).toEqual([
      expect.objectContaining({ actorId: 'Actor.lorn', name: 'An unnamed character', hpAfter: 10 }),
    ]);
  });
  it('keeps what it remembered when seeded again, so a later seed never rewinds a before', async () => {
    const posts: { hpBefore?: number }[] = [];
    const log = new HpLogReporter({
      role: () => 'act',
      actors: () => [lorn(52)],
      campaignOf: () => ({ kind: 'one', code: 'C06' }),
      post: (_code, change) => {
        posts.push(change);
        return Promise.resolve('sent');
      },
      causeFor: () => Promise.resolve({ gm: 'manual change', shown: null }),
      warn: () => undefined,
      now: () => 0,
    });
    log.seed();
    await log.onActorUpdated(lorn(40), { system: { attributes: { hp: { value: 40 } } } });
    log.seed();
    await log.onActorUpdated(lorn(30), { system: { attributes: { hp: { value: 30 } } } });

    expect(posts.map((p) => p.hpBefore)).toEqual([52, 40]);
  });
});

describe("a character's campaign", () => {
  const game = {
    user: { isGM: true },
    actors: [
      {
        type: 'party',
        uuid: 'Actor.Party',
        name: 'Party',
        getFlag: () => 'C06',
        system: { details: { members: [{ uuid: 'Actor.lorn' }] } },
      },
    ],
  };

  it("reads an unlinked token's synthetic actor as its base actor", () => {
    const synthetic = {
      isToken: true,
      uuid: 'Scene.S.Token.T.Actor.lorn',
      token: { baseActor: { uuid: 'Actor.lorn' } },
    };
    expect(campaignOfCharacter(synthetic, game as never)).toEqual({ kind: 'one', code: 'C06' });
  });

  it('reads an actor with no uuid or name as in no campaign', () => {
    expect(campaignOfCharacter({}, game as never)).toEqual({
      kind: 'none',
      characters: ['an unnamed character'],
    });
  });

  it('starts with no world at all', () => {
    const shared = {
      role: () => 'act' as const,
      campaign: () => ({ kind: 'none' as const, characters: [] }),
      causeFor: () => Promise.resolve({ gm: 'manual change', shown: null }),
      warn: () => undefined,
    };
    expect(() =>
      buildHpLog({}, { call: () => Promise.resolve('signed-out') }, shared)
    ).not.toThrow();
  });
});
