import { describe, expect, it } from 'vitest';

import { CLAIMED_FLAG, DECLINED_FLAG, PENDING_FLAG } from '../../src/automation/AutoApply.js';
import type { SpellSavePorts } from '../../src/automation/SpellSaves.js';
import { ENEMY, X1, X2, castCard, harness } from './support/spellSavesWorld.js';

/**
 * The active full GM's browser rolling enemies' saves against players' spells. Written 2026-09-14.
 * Queueing and catching up are in `spellSavesQueue.test.ts`.
 */
describe('the active full GM', () => {
  it("rolls every recorded enemy's save, claiming the card first", async () => {
    const order: string[] = [];
    const { saves, flags } = harness({
      rollSave: (_id, _index, tokens) => {
        order.push(`roll ${tokens.join(',')} claimed=${String(flags.get(`c1.${CLAIMED_FLAG}`))}`);
        return Promise.resolve({ kind: 'rolled' });
      },
    });

    await saves.onMessageCreated(castCard());

    expect(order).toEqual([`roll ${X1},${X2} claimed=true`]);
  });

  it('skips an ally and rolls for the enemy', async () => {
    const { saves, ports } = harness({}, { [X2]: { ...ENEMY, playerOwned: true } });

    await saves.onMessageCreated(castCard());

    expect(ports.rollSave).toHaveBeenCalledWith('c1', 0, [X1]);
  });

  it('waits when a target is on a scene not being viewed', async () => {
    const { saves, ports, flags } = harness({}, { [X2]: { ...ENEMY, elsewhere: true } });

    await saves.onMessageCreated(castCard());

    expect(ports.rollSave).not.toHaveBeenCalled();
    expect(flags.get(`c1.${PENDING_FLAG}`)).toBe(true);
  });

  it('declines, saying why, when nobody can roll or nobody was targeted', async () => {
    const down = harness({}, { [X1]: { ...ENEMY, hp: 0 }, [X2]: { ...ENEMY, inCombat: false } });
    await down.saves.onMessageCreated(castCard());
    expect(down.flags.get(`c1.${DECLINED_FLAG}`)).toContain('no target could roll');

    const none = harness();
    await none.saves.onMessageCreated(castCard([]));
    expect(none.flags.get(`c1.${DECLINED_FLAG}`)).toContain('no targets');
  });

  it('leaves alone a spell with no save button, a GM cast, an NPC caster and a handled card', async () => {
    for (const overrides of [
      { saveControls: () => [] },
      {
        saveControls: () => [
          { statistic: 'will' as const, dc: 20, control: 'inline-check' as const, index: 0 },
        ],
      },
      { authorIsPlayer: () => false },
      { attackerIsPlayers: () => false },
      { isHandled: () => true },
    ] as Partial<SpellSavePorts>[]) {
      const { saves, ports, flags } = harness(overrides);
      await saves.onMessageCreated(castCard());
      expect(ports.rollSave).not.toHaveBeenCalled();
      expect(flags.size).toBe(0);
    }
    const { saves, ports } = harness();
    await saves.onMessageCreated({ ...castCard(), flags: {} });
    expect(ports.rollSave).not.toHaveBeenCalled();
  });

  it('never re-rolls a claimed card, and lifts a claim only when nothing was rolled', async () => {
    const claimed = harness();
    claimed.flags.set(`c1.${CLAIMED_FLAG}`, true);
    await claimed.saves.onMessageCreated(castCard());
    expect(claimed.ports.rollSave).not.toHaveBeenCalled();
    expect(claimed.flags.get(`c1.${DECLINED_FLAG}`)).toContain('never confirmed');

    const refused = harness({
      rollSave: () => Promise.resolve({ kind: 'refused', reason: 'gone' }),
    });
    await refused.saves.onMessageCreated(castCard());
    expect(refused.flags.has(`c1.${CLAIMED_FLAG}`)).toBe(false);

    const unconfirmed = harness({
      rollSave: () => Promise.resolve({ kind: 'unconfirmed', reason: 'late' }),
    });
    await unconfirmed.saves.onMessageCreated(castCard());
    expect(unconfirmed.flags.get(`c1.${CLAIMED_FLAG}`)).toBe(true);
    expect(unconfirmed.flags.get(`c1.${DECLINED_FLAG}`)).toBe('late');
  });

  it('writes no reason on a card that was handled while it waited', async () => {
    let handled = false;
    const raced = harness({
      isHandled: () => handled,
      rollSave: () => {
        handled = true;
        return Promise.resolve({ kind: 'refused', reason: 'that card is already being handled' });
      },
    });

    await raced.saves.onMessageCreated(castCard());

    expect(raced.flags.has(`c1.${DECLINED_FLAG}`)).toBe(false);
  });
});
