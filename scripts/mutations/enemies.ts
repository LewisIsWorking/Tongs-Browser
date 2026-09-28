import type { RecordedMutation } from './shape.ts';

/**
 * Mutations for enemy damage to players (2026-09-28): enemies' strikes on player characters, the target
 * rule they exposed, and the combat-topic post of each hit. Beside `automation.ts`, which was at the limit.
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
  {
    /* ⛔ The one rule that keeps an enemy's exact HP, and so its resistances, off the public line. */
    file: 'src/bands/playerHit.ts',
    find: '    view.character !== true ||',
    replace: '    false ||',
    defect:
      "an enemy's exact damage and HP are posted to the table as though it were a player character",
    tests: ['tests/unit/playerHit.test.ts'],
  },
  {
    file: 'src/bands/playerHit.ts',
    find: '    view.hp >= before',
    replace: '    view.hp > before',
    defect: 'a change that cost a character no HP is posted as "takes 0"',
    tests: ['tests/unit/playerHit.test.ts'],
  },
  {
    file: 'src/bands/PlayerHitReporter.ts',
    find: "    if (this.ports.role() !== 'act' || hp?.value === undefined || !this.ports.enabled()) {",
    replace: "    if (this.ports.role() !== 'act' || hp?.value === undefined) {",
    defect: 'hits on player characters are still posted after a GM turns the setting off',
    tests: ['tests/unit/playerHit.test.ts', 'tests/unit/playerHitWiring.test.ts'],
  },
  {
    file: 'src/bands/startBands.ts',
    find: "    hits.onActorUpdated(actor, changes).catch(failed('Player hits'));",
    replace: '    void hits;',
    defect: 'no hit on a player character ever reaches the combat topic, and nothing says so',
    tests: ['tests/unit/playerHitWiring.test.ts'],
  },
];
