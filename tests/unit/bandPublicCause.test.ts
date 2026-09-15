import { describe, expect, it, vi } from 'vitest';

import { BandReporter } from '../../src/bands/BandReporter.js';
import type { BandPost } from '../../src/bands/CooClient.js';
import { describePublicCause } from '../../src/bands/bandCause.js';
import { watchCause } from '../../src/bands/causeWatch.js';
import type { DamageTakenMessage } from '../../src/bands/causeWatch.js';

/**
 * What the combat topic is told about a hit, decided with Lewis 2026-09-15: the weapon and attacker when
 * players can see the attacker, and both token pictures. Written 2026-09-15.
 */
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
const card = (isHealing = false): DamageTakenMessage => ({
  flags: {
    pf2e: {
      context: { type: 'damage-taken' },
      appliedDamage: { uuid: 'Actor.T', isHealing },
      origin: { uuid: 'Actor.C.Item.W', actor: 'Actor.C' },
    },
  },
  content:
    '<span data-applications="[{&quot;category&quot;:&quot;resistance&quot;,&quot;type&quot;:&quot;acid&quot;,&quot;adjustment&quot;:-2}]"></span>',
});
const names = (uuid: string) => (uuid.includes('Item') ? 'Turret Disintegrator' : 'Changer');
const changer = { name: 'Changer', image: 'https://assets.forge-vtt.com/u/changer.webp' };

describe('the public cause', () => {
  it('names the weapon and the attacker, never the resistance, and says healing', () => {
    expect(describePublicCause('Turret Disintegrator', 'Changer', false)).toBe(
      'Turret Disintegrator from Changer'
    );
    expect(describePublicCause(null, 'Kyra', true)).toBe('healed by Kyra');
    expect(describePublicCause('x'.repeat(250), 'Kyra', false)).toHaveLength(200);
  });

  it('is read from the same card as the GM cause, and only when the attacker is seen', async () => {
    const seen = hooks();
    const waiting = watchCause(seen.fake, 'pf2e', 'Actor.T', 3000, names, () => changer);
    seen.send(card());
    expect(await waiting).toEqual({
      gm: 'Turret Disintegrator from Changer; resistance acid -2',
      shown: { text: 'Turret Disintegrator from Changer', attacker: changer },
    });

    const unseen = hooks();
    const hidden = watchCause(unseen.fake, 'pf2e', 'Actor.T', 3000, names, () => null);
    unseen.send(card(true));
    expect((await hidden).shown).toBeNull();
  });
});

describe('a card that names nobody', () => {
  it('gives the GM a plain cause and the table nothing', async () => {
    const bare = hooks();
    const asked: string[] = [];
    const waiting = watchCause(bare.fake, 'pf2e', 'Actor.T', 3000, names, (uuid) => {
      asked.push(uuid);
      return changer;
    });
    bare.send({
      flags: { pf2e: { context: { type: 'damage-taken' }, appliedDamage: { uuid: 'Actor.T' } } },
    });
    expect(await waiting).toEqual({ gm: 'damage applied', shown: null });
    expect(asked).toEqual([]);

    const itemless = hooks();
    const noItem = watchCause(itemless.fake, 'pf2e', 'Actor.T', 3000, names, () => changer);
    itemless.send({
      flags: {
        pf2e: {
          context: { type: 'damage-taken' },
          appliedDamage: { uuid: 'Actor.T' },
          origin: { actor: 'Actor.C' },
        },
      },
    });
    expect((await noItem).shown?.text).toBe('Changer');
  });
});

describe('what the reporter sends', () => {
  it('adds the public cause and both pictures when they are known, and neither when they are not', async () => {
    const posts: BandPost[] = [];
    let hp = 20;
    let image: string | null = 'https://assets.forge-vtt.com/u/animal.webp';
    let shown: { text: string; attacker: typeof changer } | null = {
      text: 'Turret Disintegrator from Changer',
      attacker: changer,
    };
    const reporter = new BandReporter({
      role: () => 'act',
      campaign: () => ({ kind: 'one', code: 'C04' }),
      subjectsFor: () => [
        {
          tokenUuid: 'T',
          name: 'Animal',
          segments: Math.ceil(hp / 2),
          word: 'w',
          hp,
          maxHp: 20,
          image,
        },
      ],
      combatSubjects: () => [],
      post: (_code, post) => {
        posts.push(post);
        return Promise.resolve('sent');
      },
      causeFor: () => Promise.resolve({ gm: 'gm words', shown }),
      warn: vi.fn(),
    });

    hp = 16;
    await reporter.onActorUpdated({}, { system: { attributes: { hp: { value: hp } } } });
    shown = null;
    image = null;
    hp = 12;
    await reporter.onActorUpdated({}, { system: { attributes: { hp: { value: hp } } } });

    expect(posts[0]).toMatchObject({
      cause: 'gm words',
      publicCause: 'Turret Disintegrator from Changer',
      attackerImage: 'https://assets.forge-vtt.com/u/changer.webp',
      targetImage: 'https://assets.forge-vtt.com/u/animal.webp',
    });
    expect(Object.keys(posts[1] ?? {})).not.toEqual(
      expect.arrayContaining(['publicCause', 'attackerImage', 'targetImage'])
    );
    expect(posts[1]).not.toHaveProperty('publicCause');
    expect(posts[1]).not.toHaveProperty('targetImage');
  });
});
