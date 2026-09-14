import { describe, expect, it } from 'vitest';

import { CLAIMED_FLAG, DECLINED_FLAG, PENDING_FLAG } from '../../src/automation/AutoApply.js';
import type { SpellDamagePorts } from '../../src/automation/SpellDamage.js';
import { ENEMY, SAVES, X1, X2, cast, damageCard, harness } from './support/spellDamageWorld.js';

/**
 * The active full GM's browser applying basic-save spell damage by degree of success. Written
 * 2026-09-14. Queueing, catching up and saves arriving late are in `spellDamageQueue.test.ts`.
 */
describe('the active full GM', () => {
  it("applies each target's damage by its save, claiming the card first", async () => {
    const order: string[] = [];
    const { damage, flags } = harness({
      applyGroups: (id, groups) => {
        order.push(
          `${id} ${JSON.stringify(groups)} claimed=${String(flags.get(`d1.${CLAIMED_FLAG}`))}`
        );
        return Promise.resolve({ kind: 'applied' });
      },
    });
    flags.set(`d1.${PENDING_FLAG}`, true);

    await damage.onMessageCreated(damageCard);

    expect(order).toEqual([
      `d1 ${JSON.stringify([
        { optionId: 'half', targetTokenUuids: [X1] },
        { optionId: 'full', targetTokenUuids: [X2] },
      ])} claimed=true`,
    ]);
    expect(flags.has(`d1.${PENDING_FLAG}`)).toBe(false);
  });

  it('asks PF2e for the spell at the rank it was cast', async () => {
    const asked: unknown[] = [];
    const { damage } = harness({
      spellRule: (uuid, rank) => {
        asked.push([uuid, rank]);
        return Promise.resolve({ formula: '10d6 void', basic: true });
      },
    });

    await damage.onMessageCreated(damageCard);

    expect(asked).toEqual([['Actor.Caster.Item.Feast', 5]]);
  });

  it('declines, saying why, a roll that does not check out or a target that is not an enemy', async () => {
    const wrong = harness({
      spellRule: () => Promise.resolve({ formula: '6d6 void', basic: true }),
    });
    await wrong.damage.onMessageCreated(damageCard);
    expect(wrong.flags.get(`d1.${DECLINED_FLAG}`)).toContain("is not the spell's 6d6 void");
    expect(wrong.ports.applyGroups).not.toHaveBeenCalled();

    const ally = harness({}, undefined, { [X2]: { ...ENEMY, playerOwned: true } });
    await ally.damage.onMessageCreated(damageCard);
    expect(ally.flags.get(`d1.${DECLINED_FLAG}`)).toContain("a player's creature");
    expect(ally.ports.applyGroups).not.toHaveBeenCalled();
  });

  it('waits, with a note, for saves not rolled yet, and for a target on another scene', async () => {
    const early = harness({}, [cast, SAVES[0] ?? cast, damageCard]);
    await early.damage.onMessageCreated(damageCard);
    expect(early.flags.get(`d1.${PENDING_FLAG}`)).toBe(true);
    expect(early.flags.get(`d1.${DECLINED_FLAG}`)).toContain('waiting for 1');

    const away = harness({}, undefined, { [X1]: { ...ENEMY, elsewhere: true } });
    await away.damage.onMessageCreated(damageCard);
    expect(away.flags.get(`d1.${PENDING_FLAG}`)).toBe(true);
    expect(away.ports.applyGroups).not.toHaveBeenCalled();
  });

  it('leaves alone a card that is not spell damage, a GM card, an NPC caster and a handled card', async () => {
    for (const overrides of [
      {},
      { authorIsPlayer: () => false },
      { attackerIsPlayers: () => false },
      { isHandled: () => true },
    ] as Partial<SpellDamagePorts>[]) {
      const { damage, ports, flags } = harness(overrides);
      await damage.onMessageCreated(Object.keys(overrides).length === 0 ? cast : damageCard);
      expect(ports.applyGroups).not.toHaveBeenCalled();
      expect(flags.size).toBe(0);
    }
  });

  it('never re-applies a claimed card, and lifts a claim only when nothing was sent', async () => {
    const claimed = harness();
    claimed.flags.set(`d1.${CLAIMED_FLAG}`, true);
    await claimed.damage.onMessageCreated(damageCard);
    expect(claimed.ports.applyGroups).not.toHaveBeenCalled();
    expect(claimed.flags.get(`d1.${DECLINED_FLAG}`)).toContain('never confirmed');

    const refused = harness({
      applyGroups: () => Promise.resolve({ kind: 'refused', reason: 'gone' }),
    });
    await refused.damage.onMessageCreated(damageCard);
    expect(refused.flags.has(`d1.${CLAIMED_FLAG}`)).toBe(false);
    expect(refused.flags.get(`d1.${DECLINED_FLAG}`)).toBe('gone');

    const partly = harness({
      applyGroups: () => Promise.resolve({ kind: 'unconfirmed', reason: 'part' }),
    });
    await partly.damage.onMessageCreated(damageCard);
    expect(partly.flags.get(`d1.${CLAIMED_FLAG}`)).toBe(true);
    expect(partly.flags.get(`d1.${DECLINED_FLAG}`)).toBe('part');
  });

  it('writes no reason on a card that was handled while it waited', async () => {
    let handled = false;
    const raced = harness({
      isHandled: () => handled,
      applyGroups: () => {
        handled = true;
        return Promise.resolve({ kind: 'refused', reason: 'that card is already being handled' });
      },
    });

    await raced.damage.onMessageCreated(damageCard);

    expect(raced.flags.has(`d1.${DECLINED_FLAG}`)).toBe(false);
  });
});
