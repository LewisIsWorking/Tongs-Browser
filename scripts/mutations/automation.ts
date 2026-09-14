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
  {
    file: 'src/automation/SpellSaves.ts',
    find: '    await this.ports.setFlag(message.id, CLAIMED_FLAG, true);',
    replace: '    void CLAIMED_FLAG;',
    defect:
      'a GM browser that closes mid-roll lets the next GM connection roll the same saves again',
    tests: ['tests/unit/spellSaves.test.ts'],
  },
  {
    file: 'src/automation/SpellSaves.ts',
    find: "    const rollers = verdicts.filter((each) => each.verdict.kind === 'ok').map((each) => each.token);",
    replace:
      "    const rollers = verdicts.filter((each) => each.verdict.kind !== 'later').map((each) => each.token);",
    defect:
      "a player's ally caught in their spell is made to roll a save as though it were an enemy",
    tests: ['tests/unit/spellSaves.test.ts'],
  },
  {
    file: 'src/automation/SpellSaves.ts',
    find: "    if (cast === null || this.ports.saveControls(message)[0]?.control !== 'spell-save') {",
    replace: '    if (cast === null || this.ports.saveControls(message)[0] === undefined) {',
    defect:
      "an inline check in a spell's description is rolled automatically, guessing at its trigger",
    tests: ['tests/unit/spellSaves.test.ts'],
  },
  {
    file: 'src/automation/startSpellSaves.ts',
    find: "  if (userId !== game?.user?.id || flags?.context?.type !== 'spell-cast') {",
    replace: "  if (flags?.context?.type !== 'spell-cast') {",
    defect: "every browser writes its own user's targets onto someone else's spell card",
    tests: ['tests/unit/spellSavesWiring.test.ts'],
  },
  {
    file: 'src/automation/SpellDamage.ts',
    find: '    await this.ports.setFlag(message.id, CLAIMED_FLAG, true);',
    replace: '    void CLAIMED_FLAG;',
    defect:
      "a GM browser that closes mid-apply lets the next GM connection apply a spell's damage again",
    tests: ['tests/unit/spellDamage.test.ts'],
  },
  {
    file: 'src/automation/SpellDamage.ts',
    find: '      } while (this.again.has(message.id));',
    replace: "      } while (this.again.has('never'));",
    defect:
      "a save arriving while its spell's damage is being decided leaves the damage waiting forever",
    tests: ['tests/unit/spellDamageQueue.test.ts'],
  },
  {
    /* ⛔ Measured: rank 5 Vampiric Feast is 10d6, the base spell 6d6. */
    file: 'src/automation/validateSpellDamage.ts',
    find: '  if (cast.castRank !== damage.castRank) {',
    replace: '  if (cast.castRank === -1) {',
    defect: 'damage rolled at a higher rank than the spell was cast at is applied automatically',
    tests: ['tests/unit/validateSpellDamage.test.ts'],
  },
  {
    file: 'src/automation/validateSpellDamage.ts',
    find: "  ['criticalFailure', 'double'],",
    replace: "  ['criticalFailure', 'full'],",
    defect: 'an enemy that critically fails a basic save takes normal damage instead of double',
    tests: ['tests/unit/validateSpellDamage.test.ts'],
  },
  {
    file: 'src/automation/validateSpellDamage.ts',
    find: '  if (rule?.basic !== true) {',
    replace: '  if (rule === null) {',
    defect: 'a spell whose save is not basic has its damage halved and doubled as though it were',
    tests: ['tests/unit/validateSpellDamage.test.ts'],
  },
  {
    file: 'src/automation/validateSpellDamage.ts',
    find: '        each.timestamp < next',
    replace: '        each.timestamp > 0',
    defect: "a save rolled against a later cast of the same spell decides an earlier cast's damage",
    tests: ['tests/unit/validateSpellDamage.test.ts'],
  },
  {
    file: 'src/deck/applyThroughSystem.ts',
    find: '    selectOnly(tokens);',
    replace: '    selectOnly(tokens.slice(0, 1));',
    defect:
      "only the first enemy in a group takes a spell's damage, and the card is marked handled",
    tests: ['tests/unit/applyGroupsThroughSystem.test.ts'],
  },
];
