import { describe, expect, it } from 'vitest';

import { readEncounter } from '../../src/encounter/encounterSnapshot.js';
import type { CombatantLike, CombatLike } from '../../src/encounter/encounterSnapshot.js';

/**
 * What an encounter's wiki page is built from: its name, its scene and each combatant's initiative.
 * Added 2026-09-17.
 */
const RULES = { nameVisibility: true, mystifiedName: 'The creature' };
const pc: CombatantLike = {
  name: 'Arktos',
  initiative: 24,
  token: { name: 'Arktos' },
  actor: { hasPlayerOwner: true, ownership: { ryo: 3 } },
};
const foe = (overrides: CombatantLike = {}): CombatantLike => ({
  name: 'Captain Vex',
  initiative: 21,
  token: { name: 'Captain Vex', playersCanSeeName: false },
  actor: { hasPlayerOwner: false },
  ...overrides,
});
const read = (combat: Partial<CombatLike>) =>
  readEncounter(
    { id: 'c1', round: 1, turn: 0, turns: [pc, foe()], ...combat },
    { ryo: '111' },
    RULES
  );

describe("an encounter's wiki page facts", () => {
  it("names the encounter after its scene, and carries each combatant's initiative", () => {
    expect(read({ scene: { name: ' The Stargazer - Bridge ' } })).toMatchObject({
      name: 'The Stargazer - Bridge',
      location: 'The Stargazer - Bridge',
      allies: [{ name: 'Arktos', initiative: 24, telegramUserId: '111' }],
      enemies: [{ name: 'The creature', initiative: 21 }],
    });
  });

  it('names the scene as players see it, never a spoiler the GM hid behind a navigation name', () => {
    expect(read({ scene: { name: 'Ambush - boss reveal', navName: 'Bridge' } })).toMatchObject({
      name: 'Bridge',
      location: 'Bridge',
    });
    expect(read({ scene: { name: 'Bridge', navName: ' ' } })).toMatchObject({ location: 'Bridge' });
  });

  it("prefers the GM's own name for the encounter", () => {
    const flags = { 'tongs-browser': { encounterName: 'Captain Vex Ashburn' } };
    expect(read({ scene: { name: 'Bridge' }, flags })).toMatchObject({
      name: 'Captain Vex Ashburn',
      location: 'Bridge',
    });
    expect(
      read({ scene: { name: 'Bridge' }, flags: { 'tongs-browser': { encounterName: ' ' } } })
    ).toMatchObject({ name: 'Bridge' });
  });

  it('leaves out what Foundry does not know: no scene, no name, an unrolled initiative', () => {
    const snapshot = read({ scene: null, turns: [foe({ initiative: null })] });
    expect(snapshot).not.toHaveProperty('name');
    expect(snapshot).not.toHaveProperty('location');
    expect(snapshot?.enemies[0]).not.toHaveProperty('initiative');
    expect(read({ scene: { name: '' } })).not.toHaveProperty('location');
  });
});
