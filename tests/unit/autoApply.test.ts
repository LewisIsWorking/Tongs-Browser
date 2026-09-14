import { describe, expect, it, vi } from 'vitest';

import { DECLINED_FLAG, PENDING_FLAG } from '../../src/automation/AutoApply.js';
import type { AutoApplyPorts } from '../../src/automation/AutoApply.js';
import { TARGET, attack, card, damage, harness } from './support/autoApplyWorld.js';

/**
 * The active full GM's browser applying players' strike damage. Written 2026-09-14.
 *
 * Queueing with no GM connected, and catching up when one connects, are in `autoApplyQueue.test.ts`.
 */
describe('the active full GM', () => {
  it('applies a checked hit to the target, and clears any pending mark', async () => {
    const { auto, ports, flags } = harness({}, [attack, damage]);
    flags.set(`d1.${PENDING_FLAG}`, true);

    await auto.onMessageCreated(damage);

    expect(ports.apply).toHaveBeenCalledWith('d1', TARGET);
    expect(flags.has(`d1.${PENDING_FLAG}`)).toBe(false);
    expect(flags.has(`d1.${DECLINED_FLAG}`)).toBe(false);
  });

  it('sends damage after a miss to the deck with the reason, applying nothing', async () => {
    const { auto, ports, flags } = harness({}, [card('a1', 1_000, 'attack', 'failure'), damage]);

    await auto.onMessageCreated(damage);

    expect(ports.apply).not.toHaveBeenCalled();
    expect(flags.get(`d1.${DECLINED_FLAG}`)).toContain('did not hit');
  });

  it('declines when the recomputed formula differs', async () => {
    const { auto, flags } = harness(
      { recomputeFormula: () => Promise.resolve('2d6 bludgeoning') },
      [attack, damage]
    );

    await auto.onMessageCreated(damage);

    expect(flags.get(`d1.${DECLINED_FLAG}`)).toContain('is not the weapon');
  });

  it("leaves the GM's own rolls, NPC attackers, handled cards and non-strikes alone", async () => {
    for (const overrides of [
      { authorIsPlayer: () => false },
      { attackerIsPlayers: () => false },
      { isHandled: () => true },
    ] as Partial<AutoApplyPorts>[]) {
      const { auto, ports, flags } = harness(overrides, [attack, damage]);
      await auto.onMessageCreated(damage);
      expect(ports.apply).not.toHaveBeenCalled();
      expect(flags.size).toBe(0);
    }
    const { auto, ports } = harness({}, [attack]);
    await auto.onMessageCreated(attack);
    expect(ports.apply).not.toHaveBeenCalled();
  });

  /** ⚠️ A GM viewing another map has not decided anything: keep it queued and try again later. */
  it('keeps a hit queued when the target is on a scene not being viewed', async () => {
    const { auto, ports, flags } = harness(
      {
        targetState: () => ({
          elsewhere: true,
          exists: false,
          hp: null,
          inCombat: false,
          playerOwned: false,
        }),
      },
      [attack, damage]
    );

    await auto.onMessageCreated(damage);

    expect(ports.apply).not.toHaveBeenCalled();
    expect(flags.get(`d1.${PENDING_FLAG}`)).toBe(true);
    expect(flags.has(`d1.${DECLINED_FLAG}`)).toBe(false);
  });

  it('sends a hit on a target that left the fight to the deck', async () => {
    const { auto, flags } = harness(
      {
        targetState: () => ({
          elsewhere: false,
          exists: true,
          hp: 10,
          inCombat: false,
          playerOwned: false,
        }),
      },
      [attack, damage]
    );

    await auto.onMessageCreated(damage);

    expect(flags.get(`d1.${DECLINED_FLAG}`)).toContain('not in a running combat');
  });

  it('records why PF2e did not confirm, unless the card was handled meanwhile', async () => {
    const unconfirmed = harness(
      { apply: () => Promise.resolve({ kind: 'unconfirmed', reason: 'never landed' }) },
      [attack, damage]
    );
    await unconfirmed.auto.onMessageCreated(damage);
    expect(unconfirmed.flags.get(`d1.${DECLINED_FLAG}`)).toBe('never landed');

    let handled = false;
    const raced = harness(
      {
        isHandled: () => handled,
        apply: () => {
          handled = true;
          return Promise.resolve({ kind: 'refused', reason: 'that card is already being handled' });
        },
      },
      [attack, damage]
    );
    await raced.auto.onMessageCreated(damage);
    expect(raced.flags.has(`d1.${DECLINED_FLAG}`)).toBe(false);
  });

  it('never works on one card twice at once', async () => {
    let release: () => void = () => undefined;
    const apply = vi.fn(
      () =>
        new Promise<{ kind: 'applied' }>((resolve) => {
          release = () => {
            resolve({ kind: 'applied' });
          };
        })
    );
    const { auto } = harness({ apply }, [attack, damage]);

    const first = auto.onMessageCreated(damage);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await auto.onMessageCreated(damage);
    release();
    await first;

    expect(apply).toHaveBeenCalledTimes(1);
  });
});
