import { describe, expect, it } from 'vitest';

import { PENDING_FLAG } from '../../src/automation/AutoApply.js';
import { attack, card, damage, harness } from './support/autoApplyWorld.js';

/**
 * Queueing players' hits while no full GM is connected, and catching up when one does. Written
 * 2026-09-14, split from `autoApply.test.ts` at the 200 line limit.
 */
describe('with no full GM connected', () => {
  it("queues the player's own strike damage, and nothing else", async () => {
    const mine = harness({ role: () => 'queue' });
    await mine.auto.onMessageCreated(damage);
    expect(mine.flags.get(`d1.${PENDING_FLAG}`)).toBe(true);
    expect(mine.ports.apply).not.toHaveBeenCalled();

    const theirs = harness({ role: () => 'queue', myUserId: () => 'someone-else' });
    await theirs.auto.onMessageCreated(damage);
    await theirs.auto.onMessageCreated(attack);
    expect(theirs.flags.size).toBe(0);
  });

  it('does nothing in a browser that leaves it to the GM', async () => {
    const { auto, ports, flags } = harness({ role: () => 'leave' }, [attack, damage]);

    await auto.onMessageCreated(damage);
    await auto.catchUp();

    expect(ports.apply).not.toHaveBeenCalled();
    expect(flags.size).toBe(0);
  });
});

describe('when a full GM connects', () => {
  it('works through pending cards only, oldest first', async () => {
    const later = card('d2', 1_200, 'damage');
    const secondAttack = card('a2', 1_150, 'attack');
    const applied: string[] = [];
    const { auto, flags } = harness(
      {
        apply: (id) => {
          applied.push(id);
          return Promise.resolve({ kind: 'applied' });
        },
      },
      [attack, damage, secondAttack, later]
    );
    flags.set(`d1.${PENDING_FLAG}`, true);
    flags.set(`d2.${PENDING_FLAG}`, true);

    await auto.catchUp();

    expect(applied).toEqual(['d1', 'd2']);
  });

  it('does not catch up in a browser that is not the active full GM', async () => {
    const { auto, ports, flags } = harness({ role: () => 'queue' }, [attack, damage]);
    flags.set(`d1.${PENDING_FLAG}`, true);

    await auto.catchUp();

    expect(ports.apply).not.toHaveBeenCalled();
  });
});
