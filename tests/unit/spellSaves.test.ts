import { describe, expect, it, vi } from 'vitest';

import { CLAIMED_FLAG, DECLINED_FLAG, PENDING_FLAG } from '../../src/automation/AutoApply.js';
import { SpellSaves } from '../../src/automation/SpellSaves.js';
import type { SpellSavePorts } from '../../src/automation/SpellSaves.js';
import type { CastMessage } from '../../src/automation/spellFacts.js';
import type { TargetState } from '../../src/automation/targetCheck.js';

/**
 * Rolling enemies' saves against players' spells. Written 2026-09-14.
 *
 * ⚠️ The cast card is the measured Daze cast: `context.type "spell-cast"`, the spell's uuid on `origin`,
 * a `spell-save` button, and the targets the caster's browser recorded.
 */
const X1 = 'Scene.S.Token.X1';
const X2 = 'Scene.S.Token.X2';
const ENEMY: TargetState = {
  elsewhere: false,
  exists: true,
  hp: 100,
  inCombat: true,
  playerOwned: false,
};

const castCard = (targets: string[] = [X1, X2]): CastMessage => ({
  id: 'c1',
  timestamp: 1,
  speaker: { actor: 'Caster' },
  flags: {
    pf2e: {
      context: { type: 'spell-cast' },
      origin: { uuid: 'Actor.Caster.Item.Daze', type: 'spell' },
    },
    'tongs-browser': { targets },
  },
});

const harness = (
  overrides: Partial<SpellSavePorts> = {},
  states: Record<string, TargetState> = {}
) => {
  const flags = new Map<string, unknown>();
  const ports: SpellSavePorts = {
    role: () => 'act',
    systemId: () => 'pf2e',
    moduleId: 'tongs-browser',
    recentMessages: () => [castCard()],
    flag: (message, key) => flags.get(`${message.id}.${key}`),
    isHandled: () => false,
    authorIsPlayer: () => true,
    attackerIsPlayers: () => true,
    targetState: (token) => states[token] ?? ENEMY,
    saveControls: () => [{ statistic: 'will', dc: 21, control: 'spell-save', index: 0 }],
    rollSave: vi.fn(() => Promise.resolve({ kind: 'rolled' as const })),
    setFlag: (id, key, value) => {
      flags.set(`${id}.${key}`, value);
      return Promise.resolve();
    },
    unsetFlag: (id, key) => {
      flags.delete(`${id}.${key}`);
      return Promise.resolve();
    },
    ...overrides,
  };
  return { saves: new SpellSaves(ports), ports, flags };
};

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
});

describe('queueing and catching up', () => {
  it('does nothing outside the active full GM', async () => {
    const { saves, ports } = harness({ role: () => 'queue' });

    await saves.onMessageCreated(castCard());
    await saves.catchUp();

    expect(ports.rollSave).not.toHaveBeenCalled();
  });

  it('rolls pending casts when a GM connects, and only those', async () => {
    const pending = harness();
    pending.flags.set(`c1.${PENDING_FLAG}`, true);
    await pending.saves.catchUp();
    expect(pending.ports.rollSave).toHaveBeenCalledTimes(1);
    expect(pending.flags.has(`c1.${PENDING_FLAG}`)).toBe(false);

    const quiet = harness();
    await quiet.saves.catchUp();
    expect(quiet.ports.rollSave).not.toHaveBeenCalled();
  });

  it('never works on one card twice at once', async () => {
    let release: () => void = () => undefined;
    const rollSave = vi.fn(
      () =>
        new Promise<{ kind: 'rolled' }>((resolve) => {
          release = () => {
            resolve({ kind: 'rolled' });
          };
        })
    );
    const { saves } = harness({ rollSave });

    const first = saves.onMessageCreated(castCard());
    await new Promise((resolve) => setTimeout(resolve, 0));
    await saves.onMessageCreated(castCard());
    release();
    await first;

    expect(rollSave).toHaveBeenCalledTimes(1);
  });
});
