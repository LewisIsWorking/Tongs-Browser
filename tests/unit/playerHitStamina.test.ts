import { describe, expect, it } from 'vitest';

import type { TokenView } from '../../src/bands/bandSubject.js';
import { PlayerHitReporter } from '../../src/bands/PlayerHitReporter.js';
import { readPlayerHit } from '../../src/bands/playerHit.js';
import type { PlayerHitPost } from '../../src/bands/playerHit.js';

/** Hits on player characters under PF2e's Stamina variant; the rest of the reporter is `playerHit.test.ts`. */
const lornView: TokenView = {
  tokenUuid: 'Scene.S.Token.Lorn',
  name: 'Lorn',
  hidden: false,
  playersCanSeeName: true,
  hp: 45,
  maxHp: 52,
  traits: [],
  ally: false,
  inCombat: true,
  unseen: false,
  image: null,
  character: true,
};

const reporter = (start: Partial<TokenView>) => {
  let view: TokenView = { ...lornView, ...start };
  const posts: [string, PlayerHitPost][] = [];
  const hits = new PlayerHitReporter({
    role: () => 'act',
    enabled: () => true,
    campaign: () => ({ kind: 'one', code: 'C06' }),
    viewsFor: () => [view],
    combatViews: () => [view],
    post: (code, hit) => {
      posts.push([code, hit]);
      return Promise.resolve('sent');
    },
    causeFor: () => Promise.resolve({ gm: 'gm words', shown: null }),
    warn: () => undefined,
  });
  /* ⚠️ Foundry's update carries only what changed: a hit soaked by Stamina carries only `hp.sp.value`. */
  const tire = async (sp: number, hp?: number) => {
    view = { ...view, sp, ...(hp === undefined ? {} : { hp }) };
    const pool = hp === undefined ? { sp: { value: sp } } : { value: hp, sp: { value: sp } };
    await hits.onActorUpdated({}, { system: { attributes: { hp: pool } } });
  };
  return { hits, posts, tire };
};

/**
 * ⛔ REGRESSION, 2026-10-07, Kibwe: the world plays PF2e's Stamina variant, and six of seven hits in one enemy
 * phase changed only `hp.sp.value`. The reporter looked at `hp.value` alone, so only Tarsus's last hit, the one
 * that ran out of Stamina, reached the combat topic.
 */
describe('stamina hits (Kibwe lost six of seven hits to Stamina Points)', () => {
  const lorn = { hp: 52, maxHp: 52, sp: 14, maxSp: 14 };

  it('posts a hit that only spends Stamina Points, with the SP left', async () => {
    const { hits, posts, tire } = reporter(lorn);
    hits.seed();

    await tire(7);

    expect(posts).toEqual([
      ['C06', expect.objectContaining({ damage: 7, hp: 52, maxHp: 52, sp: 7, maxSp: 14 })],
    ]);
  });

  it('counts a hit that runs out of Stamina and carries into HP as one hit', async () => {
    const { hits, posts, tire } = reporter(lorn);
    hits.seed();

    await tire(0, 46);

    expect(posts).toEqual([['C06', expect.objectContaining({ damage: 20, hp: 46, sp: 0 })]]);
  });

  it('posts nothing when Stamina is recovered', async () => {
    const { hits, posts, tire } = reporter({ ...lorn, sp: 3 });
    hits.seed();

    await tire(14);

    expect(posts).toEqual([]);
  });

  it('leaves a character without a Stamina pool as before, with no SP in the post', () => {
    expect(readPlayerHit(lornView, { hp: 52, sp: 0 })).not.toHaveProperty('sp');
    expect(readPlayerHit({ ...lornView, sp: 2, maxSp: 0 }, { hp: 52, sp: 0 })).not.toHaveProperty(
      'maxSp'
    );
  });
});
