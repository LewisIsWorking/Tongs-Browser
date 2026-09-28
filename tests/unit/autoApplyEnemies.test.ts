import { describe, expect, it } from 'vitest';

import { DECLINED_FLAG } from '../../src/automation/AutoApply.js';
import type { AutoApplyPorts } from '../../src/automation/AutoApply.js';
import { checkPlayerTarget } from '../../src/automation/targetCheck.js';
import type { TargetState } from '../../src/automation/targetCheck.js';
import { TARGET, attack, damage, harness } from './support/autoApplyWorld.js';

/**
 * Enemies' strikes on player characters, asked for by Lewis 2026-09-28 ("Enemy damage to players", "Apply
 * at once"). The GM rolls an enemy's strike, and a hit on a player character that checks out is applied.
 */
const pc: TargetState = {
  exists: true,
  hp: 31,
  inCombat: true,
  playerOwned: false,
  isCharacter: true,
};

/** An enemy's hit as the GM rolls it: the GM wrote the card, and no player owns the attacker. */
const enemyTurn = (overrides: Partial<AutoApplyPorts> = {}) =>
  harness(
    {
      authorIsPlayer: () => false,
      attackerIsPlayers: () => false,
      attackerIsEnemy: () => true,
      enemyStrikesOn: () => true,
      targetState: () => pc,
      ...overrides,
    },
    [attack, damage]
  );

describe("an enemy's strike on a player character", () => {
  it('is applied at once when it checks out', async () => {
    const { auto, ports } = enemyTurn();

    await auto.onMessageCreated(damage);

    expect(ports.apply).toHaveBeenCalledWith('d1', TARGET);
  });

  /* ⛔ Off until a GM turns it on: a release must never start hurting the players' characters. */
  it('is left alone while its setting is off, whatever the players setting says', async () => {
    const { auto, ports, flags } = enemyTurn({ enemyStrikesOn: () => false });

    await auto.onMessageCreated(damage);

    expect(ports.apply).not.toHaveBeenCalled();
    expect(flags.size).toBe(0);
  });

  it("is not the players' side: their setting off does not stop it", async () => {
    const { auto, ports } = enemyTurn({ playerStrikesOn: () => false });

    await auto.onMessageCreated(damage);

    expect(ports.apply).toHaveBeenCalled();
  });

  it('leaves an attacker that is not an enemy alone', async () => {
    const { auto, ports, flags } = enemyTurn({ attackerIsEnemy: () => false });

    await auto.onMessageCreated(damage);

    expect(ports.apply).not.toHaveBeenCalled();
    expect(flags.size).toBe(0);
  });

  it('sends a hit on another enemy, or on a fallen character, to the deck', async () => {
    for (const state of [
      { ...pc, isCharacter: false },
      { ...pc, hp: 0 },
    ]) {
      const { auto, ports, flags } = enemyTurn({ targetState: () => state });
      await auto.onMessageCreated(damage);
      expect(ports.apply).not.toHaveBeenCalled();
      expect(flags.get(`d1.${DECLINED_FLAG}`)).toBeTruthy();
    }
  });
});

describe("the players' side, with the enemies' side on", () => {
  /* ⚠️ A player's hit is still judged by the enemies-only rule, never the player-character one. */
  it("still refuses a player's hit on a player character", async () => {
    const { auto, ports, flags } = harness(
      { enemyStrikesOn: () => true, attackerIsEnemy: () => true, targetState: () => pc },
      [attack, damage]
    );

    await auto.onMessageCreated(damage);

    expect(ports.apply).not.toHaveBeenCalled();
    expect(flags.get(`d1.${DECLINED_FLAG}`)).toContain('not an enemy');
  });
});

describe('which targets an enemy may hurt', () => {
  it('is a player character, owned or not, standing and in the fight', () => {
    expect(checkPlayerTarget(pc)).toEqual({ kind: 'ok' });
    expect(checkPlayerTarget({ ...pc, playerOwned: true })).toEqual({ kind: 'ok' });
    expect(checkPlayerTarget({ ...pc, exists: false })).toMatchObject({
      reason: 'the target is no longer on the scene',
    });
    expect(checkPlayerTarget({ ...pc, isCharacter: false })).toMatchObject({
      reason: 'the target is not a player character',
    });
    expect(checkPlayerTarget({ ...pc, hp: null })).toMatchObject({ kind: 'deck' });
    expect(checkPlayerTarget({ ...pc, inCombat: false })).toMatchObject({
      reason: 'the target is not in a running combat',
    });
  });
});
