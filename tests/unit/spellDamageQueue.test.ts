import { describe, expect, it } from 'vitest';

import { PENDING_FLAG } from '../../src/automation/AutoApply.js';
import type { SpellMessage } from '../../src/automation/spellDamageFacts.js';
import { SAVES, cast, damageCard, harness, saveCard } from './support/spellDamageWorld.js';

/**
 * Basic-save spell damage queued while no full GM is connected, caught up when one connects, and saves
 * that arrive after the damage. Written 2026-09-14.
 */
describe('with no full GM connected', () => {
  it("queues the player's own spell damage, and nothing else", async () => {
    const mine = harness({ role: () => 'queue' });
    await mine.damage.onMessageCreated(damageCard);
    await mine.damage.onMessageCreated(cast);
    expect([...mine.flags]).toEqual([[`d1.${PENDING_FLAG}`, true]]);
    expect(mine.ports.applyGroups).not.toHaveBeenCalled();

    const theirs = harness({ role: () => 'queue', myUserId: () => 'someone-else' });
    await theirs.damage.onMessageCreated(damageCard);
    await theirs.damage.onMessageCreated({ ...damageCard, author: null });
    expect(theirs.flags.size).toBe(0);
  });

  it('does nothing in a browser that leaves it to the GM, and does not catch up there', async () => {
    const { damage, ports, flags } = harness({ role: () => 'leave' });
    flags.set(`d1.${PENDING_FLAG}`, true);

    await damage.onMessageCreated(damageCard);
    await damage.catchUp();

    expect(ports.applyGroups).not.toHaveBeenCalled();
    expect([...flags.keys()]).toEqual([`d1.${PENDING_FLAG}`]);
  });
});

describe('when a full GM connects, or a save arrives', () => {
  it('works through pending cards only', async () => {
    const other = { ...damageCard, id: 'd0', timestamp: 900 };
    const { damage, ports, flags } = harness({}, [other, cast, ...SAVES, damageCard]);
    flags.set(`d1.${PENDING_FLAG}`, true);

    await damage.catchUp();

    expect(ports.applyGroups).toHaveBeenCalledTimes(1);
    expect(ports.applyGroups).toHaveBeenCalledWith('d1', expect.any(Array));
  });

  it('applies a waiting card once the last save arrives', async () => {
    const messages: SpellMessage[] = [
      cast,
      saveCard('s1', 'Scene.S.Token.X1', 'success'),
      damageCard,
    ];
    const { damage, ports, flags } = harness({}, messages);

    await damage.onMessageCreated(damageCard);
    expect(ports.applyGroups).not.toHaveBeenCalled();

    const last = saveCard('s2', 'Scene.S.Token.X2', 'criticalSuccess', 2_500);
    messages.push(last);
    await damage.onMessageCreated(last);

    expect(ports.applyGroups).toHaveBeenCalledWith('d1', [
      { optionId: 'half', targetTokenUuids: ['Scene.S.Token.X1'] },
    ]);
    expect(flags.has(`d1.${PENDING_FLAG}`)).toBe(false);
  });

  /*
   * ⛔ Without looking again, a save arriving while the card is being decided is never acted on. The
   * chat log here shows the late save only from the second look, as it would to a decision that read
   * the log before the save was posted.
   */
  it('looks again at a card when a save arrives while it is still being decided', async () => {
    const last = saveCard('s2', 'Scene.S.Token.X2', 'failure', 2_500);
    const messages: SpellMessage[] = [
      cast,
      saveCard('s1', 'Scene.S.Token.X1', 'success'),
      damageCard,
      last,
    ];
    let release: () => void = () => undefined;
    let calls = 0;
    const { damage, ports, flags } = harness({
      recentMessages: () => messages.slice(0, calls >= 2 ? 4 : 3),
      spellRule: async () => {
        calls += 1;
        if (calls === 1) {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return { formula: '10d6 void', basic: true };
      },
    });
    flags.set(`d1.${PENDING_FLAG}`, true);

    const deciding = damage.onMessageCreated(damageCard);
    await damage.onMessageCreated(last);
    release();
    await deciding;

    expect(calls).toBe(2);
    expect(ports.applyGroups).toHaveBeenCalledTimes(1);
    expect(flags.has(`d1.${PENDING_FLAG}`)).toBe(false);
  });
});
