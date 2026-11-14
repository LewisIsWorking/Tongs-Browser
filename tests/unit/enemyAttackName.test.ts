import { describe, expect, it } from 'vitest';

import { readSeenAttacker } from '../../src/bands/attackerView.js';
import type { AttackerGlobals } from '../../src/bands/attackerView.js';
import { watchCause } from '../../src/bands/causeWatch.js';
import type { DamageTakenMessage } from '../../src/bands/causeWatch.js';
import { hpChangeReason } from '../../src/bands/hpChange.js';
import { withCause } from '../../src/bands/playerHit.js';

/**
 * Only a player's attack is named in public. Written 2026-11-14, after Tongs 0.63.2 told the combat topic
 * "Alissee takes 2 from Skeleton Infantry's Lower Spears!." and Lewis said: "The tongs browser should not be
 * saying enemy's attack name, only player attack's name."
 */
const ALISSEE = 'Actor.Alissee';
const SKELETON = 'Scene.S.Token.K.Actor.K';

const hooks = () => {
  const handlers = new Map<number, (message: DamageTakenMessage) => void>();
  return {
    fake: {
      on(this: unknown, _name: string, fn: (...args: never[]) => unknown) {
        handlers.set(handlers.size + 1, fn as (message: DamageTakenMessage) => void);
        return handlers.size;
      },
      off(this: unknown, _name: string, id: number) {
        handlers.delete(id);
      },
    },
    send: (message: DamageTakenMessage) => {
      for (const fn of [...handlers.values()]) fn(message);
    },
  };
};

const card = (target: string, attacker: string, isHealing = false): DamageTakenMessage => ({
  flags: {
    pf2e: {
      context: { type: 'damage-taken' },
      appliedDamage: { uuid: target, isHealing },
      origin: { uuid: `${attacker}.Item.I`, actor: attacker },
    },
  },
});

const NAMES: Readonly<Record<string, string>> = {
  [`${SKELETON}.Item.I`]: 'Lower Spears!',
  [`${ALISSEE}.Item.I`]: 'Persistent Electricity',
  'Actor.Kyra.Item.I': 'Electric Arc',
  'Actor.Shaman.Item.I': 'Heal',
  [SKELETON]: 'Skeleton Infantry',
};
const nameOf = (uuid: string) => NAMES[uuid] ?? null;

const skeleton = { name: 'Skeleton Infantry', image: null, player: false };
const kyra = { name: 'Kyra', image: null, player: true };
const alissee = { name: 'Alissee Tra-Umna', image: null, player: true };
const shaman = { name: 'Cult Shaman', image: null, player: false };

const causeOf = async (target: string, attacker: string, seen: typeof kyra, healing = false) => {
  const world = hooks();
  const waiting = watchCause(world.fake, 'pf2e', target, 3000, nameOf, () => seen);
  world.send(card(target, attacker, healing));
  return waiting;
};

const HIT = { name: 'Alissee Tra-Umna', damage: 2, hp: 210, maxHp: 212 };

describe("an enemy's attack", () => {
  it('names the enemy alone, to the combat topic and in the HP record', async () => {
    const cause = await causeOf(ALISSEE, SKELETON, skeleton);

    expect(cause.shown).toEqual({ text: 'Skeleton Infantry', attacker: skeleton, item: null });
    expect(withCause(HIT, cause.shown)).toEqual({ ...HIT, attacker: 'Skeleton Infantry' });
    expect(hpChangeReason(cause, 'Alissee Tra-Umna')).toBe('Skeleton Infantry');
  });

  it("still tells the GM's DM what it was", async () => {
    expect((await causeOf(ALISSEE, SKELETON, skeleton)).gm).toBe(
      'Lower Spears! from Skeleton Infantry'
    );
  });

  it("names an enemy's healing by the healer alone", async () => {
    const cause = await causeOf('Actor.Ogre', 'Actor.Shaman', shaman, true);
    expect(cause.shown?.text).toBe('healed by Cult Shaman');
  });

  it("keeps a condition on the enemy itself, which is no enemy's attack", async () => {
    const own: Readonly<Record<string, string>> = {
      ...NAMES,
      [`${SKELETON}.Item.I`]: 'Persistent Fire',
    };
    const world = hooks();
    const waiting = watchCause(
      world.fake,
      'pf2e',
      SKELETON,
      3000,
      (u) => own[u] ?? null,
      () => skeleton
    );
    world.send(card(SKELETON, SKELETON));
    expect((await waiting).shown?.item).toBe('Persistent Fire');
  });
});

describe("a player's attack", () => {
  it('keeps its name, as before', async () => {
    const cause = await causeOf('Actor.Ogre', 'Actor.Kyra', kyra);
    expect(cause.shown).toEqual({
      text: 'Electric Arc from Kyra',
      attacker: kyra,
      item: 'Electric Arc',
    });
  });

  it('keeps persistent damage on the character itself named by the condition', async () => {
    const cause = await causeOf(ALISSEE, ALISSEE, alissee);
    expect(hpChangeReason(cause, 'Alissee Tra-Umna')).toBe('Persistent Electricity');
  });

  it('still names nothing when players cannot see the source', async () => {
    const world = hooks();
    const waiting = watchCause(world.fake, 'pf2e', ALISSEE, 3000, nameOf, () => null);
    world.send(card(ALISSEE, SKELETON));
    expect(hpChangeReason(await waiting, 'Alissee Tra-Umna')).toBe(
      'damage, from a source players cannot see'
    );
  });
});

describe("whose attacks are a player's", () => {
  const world = (actor: object): AttackerGlobals => ({
    fromUuidSync: () => actor,
    game: { combats: { contents: [] } },
  });
  const token = { name: 'Seen', hidden: false, playersCanSeeName: true };
  const pc = { name: 'Kyra', hasCondition: () => false, isToken: true, token };

  it('is a player character, owned or not, or any creature a player owns', () => {
    expect(readSeenAttacker(world({ ...pc, type: 'character' }), 'A')).toMatchObject({
      player: true,
    });
    expect(
      readSeenAttacker(world({ ...pc, type: 'familiar', hasPlayerOwner: true }), 'A')
    ).toMatchObject({ player: true });
  });

  it('is never an NPC or a hazard the GM runs', () => {
    for (const type of ['npc', 'hazard']) {
      const actor = { ...pc, type, hasPlayerOwner: false };
      expect(readSeenAttacker(world(actor), 'A')).toMatchObject({ player: false });
    }
  });
});
