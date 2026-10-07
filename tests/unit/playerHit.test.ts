import { describe, expect, it, vi } from 'vitest';

import type { TokenView } from '../../src/bands/bandSubject.js';
import type { PublicCause } from '../../src/bands/bandCause.js';
import { PlayerHitReporter } from '../../src/bands/PlayerHitReporter.js';
import type { PlayerHitPorts } from '../../src/bands/PlayerHitReporter.js';
import { readPlayerHit, withCause } from '../../src/bands/playerHit.js';
import type { PlayerHitPost } from '../../src/bands/playerHit.js';

/**
 * Hits on player characters told to the combat topic, asked for by Lewis 2026-09-28: "Arktos takes 12 from
 * Captain Vex's cutlass. 31/43 HP", with the character's picture.
 */
const arktos: TokenView = {
  tokenUuid: 'Scene.S.Token.Arktos',
  name: 'Arktos',
  hidden: false,
  playersCanSeeName: true,
  hp: 31,
  maxHp: 43,
  traits: [],
  ally: false,
  inCombat: true,
  unseen: false,
  image: 'https://foundry.example/arktos.webp',
  character: true,
};
const vex: PublicCause = {
  text: 'Cutlass from Captain Vex',
  attacker: { name: 'Captain Vex', image: null },
  item: 'Cutlass',
};

describe('what counts as a hit on a player character', () => {
  it('is a loss of HP on a character fighting in an encounter, with its picture', () => {
    expect(readPlayerHit(arktos, { hp: 43, sp: 0 })).toEqual({
      name: 'Arktos',
      damage: 12,
      hp: 31,
      maxHp: 43,
      characterImage: 'https://foundry.example/arktos.webp',
    });
    expect(readPlayerHit({ ...arktos, hp: -5, image: null }, { hp: 10, sp: 0 })).toEqual({
      name: 'Arktos',
      damage: 10,
      hp: 0,
      maxHp: 43,
    });
  });

  /* ⛔ Unowned since the move to the self-hosted Foundry: a character is a character, owned or not. */
  it('is none of an enemy, a hidden or out-of-combat token, healing, or an HP nobody remembered', () => {
    expect(readPlayerHit({ ...arktos, character: false }, { hp: 43, sp: 0 })).toBeNull();
    expect(readPlayerHit({ ...arktos, inCombat: false }, { hp: 43, sp: 0 })).toBeNull();
    expect(readPlayerHit({ ...arktos, hidden: true }, { hp: 43, sp: 0 })).toBeNull();
    expect(readPlayerHit({ ...arktos, maxHp: 0 }, { hp: 43, sp: 0 })).toBeNull();
    expect(readPlayerHit(arktos, { hp: 31, sp: 0 })).toBeNull();
    expect(readPlayerHit(arktos, { hp: 20, sp: 0 })).toBeNull();
    expect(readPlayerHit(arktos, undefined)).toBeNull();
  });

  it('names who hit it and with what only when players can see them', () => {
    const hit = { name: 'Arktos', damage: 12, hp: 31, maxHp: 43 };
    expect(withCause(hit, vex)).toEqual({ ...hit, attacker: 'Captain Vex', weapon: 'Cutlass' });
    expect(withCause(hit, { ...vex, item: null })).toEqual({ ...hit, attacker: 'Captain Vex' });
    expect(withCause(hit, null)).toEqual(hit);
  });
});

const reporter = (overrides: Partial<PlayerHitPorts> = {}, start: Partial<TokenView> = {}) => {
  let view: TokenView = { ...arktos, hp: 43, ...start };
  const posts: [string, PlayerHitPost][] = [];
  const warn = vi.fn();
  const ports: PlayerHitPorts = {
    role: () => 'act',
    enabled: () => true,
    campaign: () => ({ kind: 'one', code: 'C04' }),
    viewsFor: () => [view],
    combatViews: () => [view, null],
    post: (code, hit) => {
      posts.push([code, hit]);
      return Promise.resolve('sent');
    },
    causeFor: () => Promise.resolve({ gm: 'gm words', shown: vex }),
    warn,
    ...overrides,
  };
  const hits = new PlayerHitReporter(ports);
  const hurt = async (hp: number) => {
    view = { ...view, hp };
    await hits.onActorUpdated({}, { system: { attributes: { hp: { value: hp } } } });
  };
  /* ⚠️ Foundry's update carries only what changed: a hit soaked by Stamina carries only `hp.sp.value`. */
  const tire = async (sp: number, hp?: number) => {
    view = { ...view, sp, ...(hp === undefined ? {} : { hp }) };
    const pool = hp === undefined ? { sp: { value: sp } } : { value: hp, sp: { value: sp } };
    await hits.onActorUpdated({}, { system: { attributes: { hp: pool } } });
  };
  return { hits, posts, warn, hurt, tire };
};

describe('the reporter', () => {
  it('posts each hit against the HP remembered from the start of the fight', async () => {
    const { hits, posts, hurt } = reporter();
    hits.seed();

    await hurt(31);
    await hurt(35);
    await hurt(30);

    expect(posts).toEqual([
      ['C04', expect.objectContaining({ damage: 12, hp: 31, weapon: 'Cutlass' })],
      ['C04', expect.objectContaining({ damage: 5, hp: 30, attacker: 'Captain Vex' })],
    ]);
  });

  it('posts nothing from a browser that is not the acting GM, or with the setting off', async () => {
    for (const overrides of [
      { role: () => 'defer' as const },
      { enabled: () => false },
    ] as Partial<PlayerHitPorts>[]) {
      const { hits, posts, hurt } = reporter(overrides);
      hits.seed();
      await hurt(31);
      expect(posts).toEqual([]);
    }
  });

  it('remembers a character first seen mid-fight without guessing what it lost', async () => {
    const { posts, hurt } = reporter();

    await hurt(31);
    await hurt(25);

    expect(posts).toEqual([['C04', expect.objectContaining({ damage: 6, hp: 25 })]]);
  });

  it('tells the GM once when the fight has no one campaign, and when a post fails', async () => {
    const lost = reporter({ campaign: () => ({ kind: 'none', characters: [] }) });
    lost.hits.seed();
    await lost.hurt(31);
    await lost.hurt(20);
    expect(lost.posts).toEqual([]);
    expect(lost.warn).toHaveBeenCalledTimes(1);

    const failing = reporter({ post: () => Promise.reject(new Error('down')) });
    failing.hits.seed();
    await failing.hurt(31);
    expect(failing.warn).toHaveBeenCalledWith('Tongs Browser could not post the hit on Arktos.');
  });

  it('ignores a change that is not to HP, and an actor with no character token', async () => {
    const { hits, posts } = reporter({ viewsFor: () => [null] });
    hits.seed();
    await hits.onActorUpdated({}, { name: 'Renamed' });
    await hits.onActorUpdated({}, { system: { attributes: { hp: { value: 1 } } } });
    expect(posts).toEqual([]);
  });
});

/**
 * ⛔ REGRESSION, 2026-10-07, Kibwe: the world plays PF2e's Stamina variant, and six of seven hits in one enemy
 * phase changed only `hp.sp.value`. The reporter looked at `hp.value` alone, so only Tarsus's last hit, the one
 * that ran out of Stamina, reached the combat topic.
 */
describe('stamina hits (Kibwe lost six of seven hits to Stamina Points)', () => {
  const lorn = { hp: 52, maxHp: 52, sp: 14, maxSp: 14 };

  it('posts a hit that only spends Stamina Points, with the SP left', async () => {
    const { hits, posts, tire } = reporter({}, lorn);
    hits.seed();

    await tire(7);

    expect(posts).toEqual([
      ['C04', expect.objectContaining({ damage: 7, hp: 52, maxHp: 52, sp: 7, maxSp: 14 })],
    ]);
  });

  it('counts a hit that runs out of Stamina and carries into HP as one hit', async () => {
    const { hits, posts, tire } = reporter({}, lorn);
    hits.seed();

    await tire(0, 46);

    expect(posts).toEqual([['C04', expect.objectContaining({ damage: 20, hp: 46, sp: 0 })]]);
  });

  it('posts nothing when Stamina is recovered', async () => {
    const { hits, posts, tire } = reporter({}, { ...lorn, sp: 3 });
    hits.seed();

    await tire(14);

    expect(posts).toEqual([]);
  });

  it('leaves a character without a Stamina pool as before, with no SP in the post', () => {
    expect(readPlayerHit(arktos, { hp: 43, sp: 0 })).not.toHaveProperty('sp');
    expect(readPlayerHit({ ...arktos, sp: 2, maxSp: 0 }, { hp: 43, sp: 0 })).not.toHaveProperty(
      'maxSp'
    );
  });
});
