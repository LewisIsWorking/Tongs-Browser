import { describe, expect, it } from 'vitest';

import { DECLINED_FLAG, PENDING_FLAG } from '../../src/automation/AutoApply.js';
import type { SpellSavePorts } from '../../src/automation/SpellSaves.js';
import type { TargetState } from '../../src/automation/targetCheck.js';
import * as damageWorld from './support/spellDamageWorld.js';
import * as savesWorld from './support/spellSavesWorld.js';

/**
 * Enemies' basic-save spells on player characters, asked for by Lewis 2026-09-28 ("Strikes and basic-save
 * spells", "The GM's browser rolls them"): the GM casts, the characters' saves are rolled in the GM's
 * browser, and the damage is applied by degree of success, all as for players' spells.
 */
const pc: TargetState = {
  exists: true,
  hp: 31,
  inCombat: true,
  playerOwned: false,
  isCharacter: true,
};

/** The GM's cast for an enemy: no player wrote the card, and no player owns the caster. */
const enemySide = {
  authorIsPlayer: () => false,
  attackerIsPlayers: () => false,
  attackerIsEnemy: () => true,
  enemySpellsOn: () => true,
};
const pcs = { [savesWorld.X1]: pc, [savesWorld.X2]: pc };

describe("an enemy's spell save against player characters", () => {
  it("rolls every targeted character's save", async () => {
    const { saves, ports } = savesWorld.harness(enemySide, pcs);

    await saves.onMessageCreated(savesWorld.castCard());

    expect(ports.rollSave).toHaveBeenCalledWith('c1', 0, [savesWorld.X1, savesWorld.X2]);
  });

  it('skips a target that is not a player character, and one already down', async () => {
    const { saves, ports } = savesWorld.harness(enemySide, {
      [savesWorld.X1]: { ...pc, isCharacter: false },
      [savesWorld.X2]: pc,
    });
    await saves.onMessageCreated(savesWorld.castCard());
    expect(ports.rollSave).toHaveBeenCalledWith('c1', 0, [savesWorld.X2]);

    const down = savesWorld.harness(enemySide, { [savesWorld.X1]: { ...pc, hp: 0 } });
    await down.saves.onMessageCreated(savesWorld.castCard([savesWorld.X1]));
    expect(down.ports.rollSave).not.toHaveBeenCalled();
    expect(down.flags.get(`c1.${DECLINED_FLAG}`)).toContain('no target could roll');
  });

  /* ⛔ Off until a GM turns it on, whatever the players' setting says. */
  it('is left alone while its setting is off, or by a caster that is not an enemy', async () => {
    for (const overrides of [
      { ...enemySide, enemySpellsOn: () => false },
      { ...enemySide, attackerIsEnemy: () => false },
    ] as Partial<SpellSavePorts>[]) {
      const { saves, ports, flags } = savesWorld.harness(overrides, pcs);
      await saves.onMessageCreated(savesWorld.castCard());
      expect(ports.rollSave).not.toHaveBeenCalled();
      expect(flags.size).toBe(0);
    }
  });

  it("does not stop a player's own spell when the players' setting is off", async () => {
    const { saves, ports } = savesWorld.harness({ ...enemySide, playerSpellsOn: () => false }, pcs);
    await saves.onMessageCreated(savesWorld.castCard());
    expect(ports.rollSave).toHaveBeenCalled();
  });
});

describe("an enemy's basic-save spell damage on player characters", () => {
  const states = { [damageWorld.X1]: pc, [damageWorld.X2]: pc };

  it("applies each character's damage by its save", async () => {
    const { damage, ports } = damageWorld.harness(enemySide, undefined, states);

    await damage.onMessageCreated(damageWorld.damageCard);

    expect(ports.applyGroups).toHaveBeenCalledWith('d1', [
      { optionId: 'half', targetTokenUuids: [damageWorld.X1] },
      { optionId: 'full', targetTokenUuids: [damageWorld.X2] },
    ]);
  });

  it('sends damage on a target that is not a player character to the deck', async () => {
    const { damage, ports, flags } = damageWorld.harness(enemySide, undefined, {
      ...states,
      [damageWorld.X2]: { ...pc, isCharacter: false },
    });

    await damage.onMessageCreated(damageWorld.damageCard);

    expect(ports.applyGroups).not.toHaveBeenCalled();
    expect(flags.get(`d1.${DECLINED_FLAG}`)).toContain('not a player character');
    expect(flags.has(`d1.${PENDING_FLAG}`)).toBe(false);
  });

  it('is left alone while its setting is off', async () => {
    const { damage, ports, flags } = damageWorld.harness(
      { ...enemySide, enemySpellsOn: () => false },
      undefined,
      states
    );
    await damage.onMessageCreated(damageWorld.damageCard);
    expect(ports.applyGroups).not.toHaveBeenCalled();
    expect(flags.size).toBe(0);
  });

  /* ⚠️ A player's spell is still judged by the enemies-only rule: an unowned party member is no enemy. */
  it("still refuses a player's spell damage on a player character", async () => {
    const { damage, ports, flags } = damageWorld.harness(
      { attackerIsEnemy: () => true, enemySpellsOn: () => true },
      undefined,
      states
    );
    await damage.onMessageCreated(damageWorld.damageCard);
    expect(ports.applyGroups).not.toHaveBeenCalled();
    expect(flags.get(`d1.${DECLINED_FLAG}`)).toContain('not an enemy');
  });
});
