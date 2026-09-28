import type { RecordedMutation } from './shape.ts';

/**
 * Mutations for enemies' strikes on player characters, and the target rule they exposed. Added
 * 2026-09-28, beside `automation.ts` because that file was at the 200 line limit.
 *
 * Each is a rule whose loss applies damage to the wrong side, or without the GM having asked for it.
 */
export const ENEMIES_MUTATIONS: readonly RecordedMutation[] = [
  {
    /* ⛔ Found writing this: every character is unowned after the move to the self-hosted Foundry. */
    file: 'src/automation/targetCheck.ts',
    find: '  if (state.isCharacter) {',
    replace: '  if (state.isCharacter && state.hp === -1) {',
    defect: "a player's hit on an unowned party member is applied as though it were an enemy",
    tests: ['tests/unit/automationFacts.test.ts', 'tests/unit/autoApplyEnemies.test.ts'],
  },
  {
    file: 'src/automation/targetCheck.ts',
    find: '  if (!state.isCharacter) {',
    replace: '  if (!state.exists) {',
    defect: "an enemy's hit on another enemy is applied as though it struck a player character",
    tests: ['tests/unit/autoApplyEnemies.test.ts'],
  },
  {
    file: 'src/automation/AutoApply.ts',
    find: '      !players && this.ports.enemyStrikesOn() && this.ports.attackerIsEnemy(damage.actorId);',
    replace: '      !players && this.ports.attackerIsEnemy(damage.actorId);',
    defect: "enemies' hits are applied to player characters in a world whose GM never turned it on",
    tests: ['tests/unit/autoApplyEnemies.test.ts'],
  },
];
