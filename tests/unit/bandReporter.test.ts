import { describe, expect, it, vi } from 'vitest';

import { BandReporter } from '../../src/bands/BandReporter.js';
import type { BandPorts } from '../../src/bands/BandReporter.js';
import type { BandSubject } from '../../src/bands/bandSubject.js';
import type { BandPost } from '../../src/bands/CooClient.js';

/**
 * When a band is told publicly, when only the GM hears, and in what order. Written 2026-09-14.
 */
const subject = (hp: number, overrides: Partial<BandSubject> = {}): BandSubject => ({
  tokenUuid: 'Scene.S.Token.G',
  name: 'Goblin',
  segments: Math.ceil((hp * 10) / 28),
  word: `word ${String(hp)}`,
  hp,
  maxHp: 28,
  ...overrides,
});
const HP_CHANGE = { system: { attributes: { hp: { value: 1 } } } };

const harness = (
  overrides: Partial<BandPorts> = {},
  current: { value: (BandSubject | null)[] } = { value: [subject(28)] }
) => {
  const posts: BandPost[] = [];
  const ports: BandPorts = {
    role: () => 'act',
    campaign: () => 'C06',
    subjectsFor: () => current.value,
    combatSubjects: () => current.value,
    post: (_campaign, post) => {
      posts.push(post);
      return Promise.resolve('sent');
    },
    warn: vi.fn(),
    ...overrides,
  };
  return { reporter: new BandReporter(ports), ports, posts, current };
};

describe('telling the table', () => {
  it('announces a band change, and only DMs a change inside the same band', async () => {
    const { reporter, posts, current } = harness();
    reporter.seed();

    current.value = [subject(26)];
    await reporter.onActorUpdated({}, HP_CHANGE);
    current.value = [subject(17)];
    await reporter.onActorUpdated({}, HP_CHANGE);

    expect(posts.map((post) => [post.hp, post.announce])).toEqual([
      [26, false],
      [17, true],
    ]);
    expect(posts[1]).toEqual({
      name: 'Goblin',
      segments: 7,
      word: 'word 17',
      hp: 17,
      maxHp: 28,
      announce: true,
    });
  });

  it('announces a token it has never seen, and says nothing when HP did not really move', async () => {
    const { reporter, posts, current } = harness({}, { value: [subject(20)] });

    await reporter.onActorUpdated({}, HP_CHANGE);
    await reporter.onActorUpdated({}, HP_CHANGE);
    current.value = [null];
    await reporter.onActorUpdated({}, HP_CHANGE);

    expect(posts.map((post) => post.announce)).toEqual([true]);
  });

  it('seeds a token once, keeping what was already told', async () => {
    const { reporter, posts, current } = harness();
    reporter.seed();
    current.value = [subject(10)];
    await reporter.onActorUpdated({}, HP_CHANGE);
    current.value = [subject(10), null];
    reporter.seed();
    await reporter.onActorUpdated({}, HP_CHANGE);

    expect(posts).toHaveLength(1);
  });

  it('does nothing outside the active full GM, without HP in the change, or with no campaign', async () => {
    for (const [overrides, changes] of [
      [{ role: () => 'queue' as const }, HP_CHANGE],
      [{ role: () => 'leave' as const }, HP_CHANGE],
      [{}, { system: { attributes: { ac: { value: 20 } } } }],
      [{}, null],
      [{ campaign: () => '' }, HP_CHANGE],
    ] as const) {
      const { reporter, posts } = harness(overrides);
      await reporter.onActorUpdated({}, changes);
      expect(posts).toEqual([]);
    }
  });

  it('posts one at a time, in the order the changes happened', async () => {
    const order: number[] = [];
    let release: () => void = () => undefined;
    const { reporter, current } = harness({
      post: async (_campaign, post) => {
        if (post.hp === 20) {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        order.push(post.hp);
        return 'sent';
      },
    });

    current.value = [subject(20)];
    const first = reporter.onActorUpdated({}, HP_CHANGE);
    current.value = [subject(10)];
    const second = reporter.onActorUpdated({}, HP_CHANGE);
    /* The queue starts the first post a turn later; release it only once it is waiting. */
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    await Promise.all([first, second]);

    expect(order).toEqual([20, 10]);
  });

  it('warns once while signed out, again after a success, and on every failure', async () => {
    const outcomes = ['signed-out', 'signed-out', 'sent', 'signed-out', 'failed'] as const;
    let answer: (typeof outcomes)[number] = 'sent';
    const { reporter, ports, current } = harness({ post: () => Promise.resolve(answer) });
    let hp = 28;
    for (const outcome of outcomes) {
      answer = outcome;
      hp -= 1;
      current.value = [subject(hp)];
      await reporter.onActorUpdated({}, HP_CHANGE);
    }
    const failing = harness({ post: () => Promise.reject(new Error('offline')) });
    await failing.reporter.onActorUpdated({}, HP_CHANGE);

    expect(
      vi.mocked(ports.warn).mock.calls.map(([message]) => message.includes('not signed in'))
    ).toEqual([true, true, false]);
    expect(failing.ports.warn).toHaveBeenCalledWith(
      expect.stringContaining("could not post Goblin's")
    );
  });
});
