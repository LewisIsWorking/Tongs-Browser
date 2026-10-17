import { describe, expect, it } from 'vitest';

import type { BandCause } from '../../src/bands/bandCause.js';
import type { HpChangePost } from '../../src/bands/hpChange.js';
import { HpLogReporter, NOT_DEPLOYED } from '../../src/bands/HpLogReporter.js';
import type { HpLogOutcome } from '../../src/bands/HpLogReporter.js';
import type { CampaignChoice } from '../../src/bands/partyCampaign.js';

/** Every HP and Stamina change on a player character, recorded in ComeOnOverUno. Added 2026-10-17. */
const AT = Date.UTC(2026, 8, 1, 19, 30);

const daichi = (hp: number, sp: number) => ({
  id: 'daichi',
  uuid: 'Actor.daichi',
  name: 'Daichi Kenshin',
  type: 'character',
  system: { attributes: { hp: { value: hp, max: 40, sp: { value: sp, max: 35 } } } },
});

const manual: BandCause = { gm: 'manual change', shown: null };

const reporter = (
  options: {
    actors?: unknown[];
    role?: 'act' | 'leave';
    choice?: CampaignChoice;
    outcome?: HpLogOutcome;
    cause?: BandCause;
  } = {}
) => {
  const posts: [string, HpChangePost][] = [];
  const warnings: string[] = [];
  const log = new HpLogReporter({
    role: () => options.role ?? 'act',
    actors: () => options.actors ?? [],
    campaignOf: () => options.choice ?? { kind: 'one', code: 'C06' },
    post: (code, change) => {
      posts.push([code, change]);
      return Promise.resolve(options.outcome ?? 'sent');
    },
    causeFor: () => Promise.resolve(options.cause ?? manual),
    warn: (message) => warnings.push(message),
    now: () => AT,
  });
  /* ⚠️ Foundry's update carries only what changed; the actor already shows the new values. */
  const change = async (actor: ReturnType<typeof daichi>, pool: object) =>
    log.onActorUpdated(actor, { system: { attributes: { hp: pool } } });
  return { log, posts, warnings, change };
};

/**
 * ⛔ THE CASE THAT STARTED THIS, C06 2026-09-01: Daichi's Stamina fell from 35 to 8 by a sheet edit, with no
 * card, no record, and later no chat log either.
 */
describe('the HP log', () => {
  it('records a manual Stamina edit with both values, the time and "manual change"', async () => {
    const { log, posts, change } = reporter({ actors: [daichi(40, 35)] });
    log.seed();

    await change(daichi(40, 8), { sp: { value: 8 } });

    expect(posts).toEqual([
      [
        'C06',
        {
          actorId: 'daichi',
          name: 'Daichi Kenshin',
          hpBefore: 40,
          hpAfter: 40,
          maxHp: 40,
          spBefore: 35,
          spAfter: 8,
          maxSp: 35,
          reason: 'manual change',
          at: '2026-09-01T19:30:00.000Z',
        },
      ],
    ]);
  });

  it('records rises too: Stamina restored, and healing with its source', async () => {
    const healed: BandCause = {
      gm: 'healed by Heal from Kyra',
      shown: {
        text: 'healed by Heal from Kyra',
        item: 'Heal',
        attacker: { name: 'Kyra' } as never,
      },
    };
    const { log, posts, change } = reporter({ actors: [daichi(20, 8)], cause: healed });
    log.seed();

    await change(daichi(30, 35), { value: 30, sp: { value: 35 } });

    expect(posts[0]?.[1]).toMatchObject({ hpBefore: 20, hpAfter: 30, spBefore: 8, spAfter: 35 });
    expect(posts[0]?.[1].reason).toBe('healed by Heal from Kyra');
  });

  it('records a character first seen mid-change with no "before", rather than a guess', async () => {
    const { posts, change } = reporter();

    await change(daichi(31, 0), { value: 31 });

    expect(posts[0]?.[1]).not.toHaveProperty('hpBefore');
    expect(posts[0]?.[1]).not.toHaveProperty('spBefore');
    expect(posts[0]?.[1]).toMatchObject({ hpAfter: 31, spAfter: 0 });
  });

  it("remembers in every browser but records only in the acting GM's", async () => {
    const { log, posts, change } = reporter({ actors: [daichi(40, 35)], role: 'leave' });
    log.seed();

    await change(daichi(40, 8), { sp: { value: 8 } });

    expect(posts).toEqual([]);
  });

  it('ignores enemies, updates that touch no pool, and updates that change nothing', async () => {
    const { log, posts, change } = reporter({ actors: [daichi(40, 35)] });
    log.seed();

    await change({ ...daichi(10, 0), type: 'npc' }, { value: 10 });
    await log.onActorUpdated(daichi(40, 35), { name: 'Daichi' });
    await change(daichi(40, 35), { value: 40 });

    expect(posts).toEqual([]);
  });

  it('tells the GM once when a character has no campaign, and records nothing', async () => {
    const { posts, warnings, change } = reporter({
      choice: { kind: 'none', characters: ['Daichi Kenshin'] },
    });

    await change(daichi(30, 0), { value: 30 });
    await change(daichi(20, 0), { value: 20 });

    expect(posts).toEqual([]);
    expect(warnings).toEqual([
      "Tongs Browser did not record Daichi Kenshin's HP change: no party with a Path Wars campaign lists them.",
    ]);
  });

  it('tells the GM once that the server is not updated yet, and keeps trying', async () => {
    const { posts, warnings, change } = reporter({ outcome: 'not-deployed' });

    await change(daichi(30, 0), { value: 30 });
    await change(daichi(20, 0), { value: 20 });

    expect(posts).toHaveLength(2);
    expect(warnings).toEqual([NOT_DEPLOYED]);
  });
});
