import type { RecordedMutation } from './shape.ts';

/**
 * Phase 2 auto-apply's mutations. Added 2026-09-14.
 *
 * Each is a rule whose loss still applies damage, only to the wrong hit, twice, or from the wrong
 * browser. The claim rule was found in a live Foundry before it was written down here.
 */
export const AUTOMATION_MUTATIONS: readonly RecordedMutation[] = [
  {
    /* ⛔ Found live: a GM browser closing between PF2e applying and the handled marker re-applied a hit. */
    file: 'src/automation/AutoApply.ts',
    find: '    await this.ports.setFlag(message.id, CLAIMED_FLAG, true);',
    replace: '    void CLAIMED_FLAG;',
    defect:
      'a GM browser that closes mid-apply lets the next GM connection apply the same hit again',
    tests: ['tests/unit/autoApply.test.ts'],
  },
  {
    file: 'src/automation/AutoApply.ts',
    find: '    if (this.ports.flag(message, CLAIMED_FLAG) === true) {',
    replace: '    if (this.ports.flag(message, CLAIMED_FLAG) === "never") {',
    defect: 'a hit whose automatic apply was never confirmed is applied again instead of checked',
    tests: ['tests/unit/autoApply.test.ts'],
  },
  {
    file: 'src/automation/automationRole.ts',
    find: '  if (active?.role !== GAMEMASTER_ROLE) {',
    replace: '  if (active === null || active === undefined) {',
    defect: "an Assistant GM's browser applies players' damage, against the decision",
    tests: ['tests/unit/automationFacts.test.ts'],
  },
  {
    /* ⛔ Measured: a missed attack's card still rolls damage recorded as success. */
    file: 'src/automation/validateStrike.ts',
    find: '  if (attack.outcome === null || !HITS.includes(attack.outcome)) {',
    replace: '  if (attack.outcome === null) {',
    defect: 'damage rolled after a miss is applied to the enemy automatically',
    tests: ['tests/unit/validateStrike.test.ts', 'tests/unit/autoApply.test.ts'],
  },
  {
    file: 'src/automation/validateStrike.ts',
    find: '  if (damage.total < damage.min || damage.total > damage.max) {',
    replace: '  if (damage.total < damage.min) {',
    defect: 'a player who writes a damage total above what the weapon can roll has it applied',
    tests: ['tests/unit/validateStrike.test.ts'],
  },
  {
    file: 'src/automation/recentStrikeMessages.ts',
    find: '  if (game?.user?.isGM !== true) {',
    replace: '  if (game === undefined) {',
    defect: "a player's browser reads chat messages it was never meant to see",
    tests: ['tests/unit/autoApplyWiring.test.ts'],
  },
  {
    file: 'src/automation/targetCheck.ts',
    find: '  if (state.playerOwned) {',
    replace: '  if (state.playerOwned && state.hp === -1) {',
    defect: "a player's hit on an ally is applied automatically as though it were an enemy",
    tests: ['tests/unit/automationFacts.test.ts'],
  },
];
