import { describe, expect, it, vi } from 'vitest';

import { CLAIMED_FLAG, DECLINED_FLAG, PENDING_FLAG } from '../../src/automation/AutoApply.js';
import type { AutoApplyPorts } from '../../src/automation/AutoApply.js';
import { TARGET, attack, card, damage, harness } from './support/autoApplyWorld.js';

/**
 * The active full GM's browser applying players' strike damage. Written 2026-09-14.
 *
 * Queueing with no GM connected, and catching up when one connects, are in `autoApplyQueue.test.ts`.
 */
describe('the claim written before clicking', () => {
  /** ⛔ Measured live: a GM browser closing between PF2e applying and the handled marker re-applied a hit. */
  it('is on the card before PF2e is asked to apply', async () => {
    const order: string[] = [];
    const { auto, flags } = harness(
      {
        apply: () => {
          order.push(`apply, claimed=${String(flags.get(`d1.${CLAIMED_FLAG}`))}`);
          return Promise.resolve({ kind: 'applied' });
        },
      },
      [attack, damage]
    );

    await auto.onMessageCreated(damage);

    expect(order).toEqual(['apply, claimed=true']);
  });

  it('never retries a claimed card, sending it to the deck to be checked', async () => {
    const { auto, ports, flags } = harness({}, [attack, damage]);
    flags.set(`d1.${CLAIMED_FLAG}`, true);
    flags.set(`d1.${PENDING_FLAG}`, true);

    await auto.catchUp();

    expect(ports.apply).not.toHaveBeenCalled();
    expect(flags.get(`d1.${DECLINED_FLAG}`)).toContain('never confirmed');
    expect(flags.has(`d1.${PENDING_FLAG}`)).toBe(false);
  });

  it('is lifted when nothing was clicked, and kept when PF2e did not confirm', async () => {
    const refused = harness(
      {
        apply: () =>
          Promise.resolve({ kind: 'refused', reason: 'the target is no longer on the scene' }),
      },
      [attack, damage]
    );
    await refused.auto.onMessageCreated(damage);
    expect(refused.flags.has(`d1.${CLAIMED_FLAG}`)).toBe(false);

    const unconfirmed = harness(
      { apply: () => Promise.resolve({ kind: 'unconfirmed', reason: 'never landed' }) },
      [attack, damage]
    );
    await unconfirmed.auto.onMessageCreated(damage);
    expect(unconfirmed.flags.get(`d1.${CLAIMED_FLAG}`)).toBe(true);
  });
});

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

  /* ⛔ Found live 2026-09-17: PF2e names every die it adds, so a die with no name was not PF2e's. */
  it('declines a die PF2e did not add', async () => {
    const typed = {
      ...damage,
      flags: {
        pf2e: {
          ...(damage.flags as { pf2e: object }).pf2e,
          dice: [
            { slug: 'Wrote It Myself', label: 'Wrote It Myself', diceNumber: 8, enabled: true },
          ],
        },
      },
    };
    const { auto, flags } = harness({}, [attack, typed]);

    await auto.onMessageCreated(typed);

    expect(flags.get(`d1.${DECLINED_FLAG}`)).toContain('not one PF2e added');
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

  it('sends a hit on a target that left the fight to the deck', async () => {
    const { auto, flags } = harness(
      {
        targetState: () => ({
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
