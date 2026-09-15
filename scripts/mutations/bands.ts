import type { RecordedMutation } from './shape.ts';

/**
 * Health bands' mutations. Added 2026-09-14.
 *
 * Each is a rule whose loss still posts a band, only to the wrong audience, under the wrong name, too
 * often, or with a signed-out GM.
 */
export const BANDS_MUTATIONS: readonly RecordedMutation[] = [
  {
    file: 'src/bands/bandSubject.ts',
    find: '  if (view.ally || !view.inCombat || view.hidden || view.unseen || view.maxHp <= 0) {',
    replace: '  if (view.ally || !view.inCombat || view.unseen || view.maxHp <= 0) {',
    defect: "a token the GM has hidden is announced to the players' combat topic",
    tests: ['tests/unit/bandSubject.test.ts'],
  },
  {
    file: 'src/bands/bandSubject.ts',
    find: '    name: view.playersCanSeeName || !rules.nameVisibility ? view.name : rules.mystifiedName,',
    replace: '    name: view.name,',
    defect: "a creature's real name is posted when players are only meant to see 'The creature'",
    tests: ['tests/unit/bandSubject.test.ts'],
  },
  {
    file: 'src/bands/BandReporter.ts',
    find: '        announce: before?.segments !== subject.segments,',
    replace: '        announce: true,',
    defect: 'every scratch inside the same band floods the combat topic',
    tests: ['tests/unit/bandReporter.test.ts'],
  },
  {
    file: 'src/bands/BandReporter.ts',
    find: "    if (this.ports.role() !== 'act' || hp?.value === undefined) {",
    replace: '    if (hp?.value === undefined) {',
    defect: 'every open browser, players included, reports the same hit',
    tests: ['tests/unit/bandReporter.test.ts'],
  },
  {
    /* ⛔ COO rotates refresh tokens. */
    file: 'src/bands/CooClient.ts',
    find: '    this.refreshing ??= this.refresh().finally(() => {',
    replace: '    this.refreshing = this.refresh().finally(() => {',
    defect: 'two bands posted at once spend the refresh token twice and sign the GM out',
    tests: ['tests/unit/cooClient.test.ts'],
  },
  {
    file: 'src/bands/healthBands.ts',
    find: '  return Math.min(10, Math.ceil((Math.min(hp, max) * 10) / max));',
    replace: '  return Math.min(10, Math.round((Math.min(hp, max) * 10) / max));',
    defect:
      'an enemy at 51% is posted as a band lower than it is, rounded to nearest instead of up',
    tests: ['tests/unit/healthBands.test.ts'],
  },
  {
    file: 'src/bands/causeWatch.ts',
    find: "      if (flags.context?.type === 'damage-taken' && flags.appliedDamage?.uuid === actorUuid) {",
    replace: "      if (flags.context?.type === 'damage-taken') {",
    defect: "one enemy's HP change is blamed on the weapon that hit a different enemy",
    tests: ['tests/unit/bandCause.test.ts'],
  },
  {
    file: 'src/bands/partyCampaign.ts',
    find: "  return codes.length === 1 ? { kind: 'one', code: only } : { kind: 'mixed', codes };",
    replace: "  return { kind: 'one', code: only };",
    defect: "a fight between two campaigns' characters posts its bands into one of their topics",
    tests: ['tests/unit/partyCampaign.test.ts'],
  },
  {
    file: 'src/bands/combatCampaign.ts',
    find: "      if (actor?.type !== 'character' || actor.hasPlayerOwner !== true) {",
    replace: '      if (actor === null || actor === undefined) {',
    defect: "an enemy's party, or a companion's, decides which campaign hears about the fight",
    tests: ['tests/unit/partyCampaign.test.ts'],
  },
  {
    /* ⛔ Found live: reading membership from actor.parties missed a party made mid-session. */
    file: 'src/bands/combatCampaign.ts',
    find: '            .filter((party) => uuid !== undefined && party.members.includes(uuid))',
    replace: '            .filter(() => uuid !== undefined)',
    defect:
      "every party's campaign is counted for every character, so one campaign's fight reads as mixed",
    tests: ['tests/unit/partyCampaign.test.ts'],
  },
  {
    /* ⛔ An unlinked token carries a synthetic actor whose uuid no party lists. */
    file: 'src/bands/combatCampaign.ts',
    find: '      const uuid = combatant.token?.baseActor?.uuid ?? actor.uuid;',
    replace: '      const uuid = actor.uuid;',
    defect: 'a player character on an unlinked token is in no party, so its fight posts nothing',
    tests: ['tests/unit/combatCampaignMatch.test.ts'],
  },
  {
    /* ⛔ Found live: a warning that named nobody gave the GM nothing to act on. */
    file: 'src/bands/partyCampaign.ts',
    find: "    return { kind: 'none', characters: characters.map((c) => c.name) };",
    replace: "    return { kind: 'none', characters: [] };",
    defect: 'the GM is told no party has a campaign, not which character is missing from one',
    tests: ['tests/unit/combatCampaignMatch.test.ts'],
  },
  {
    /* ⛔ Found live: 24 parties outgrew the window and the first ones could not be reached. */
    file: 'src/bands/partyCampaignsMenu.ts',
    find: '    content: `<div class="${PARTY_LIST_CLASS}">${content}</div>`,',
    replace: '    content,',
    defect:
      'a world with many parties gets a dialog taller than the window whose first parties cannot be reached',
    tests: ['tests/unit/partyCampaignsMenu.test.ts'],
  },
  {
    /* ⛔ Several encounters run at once, each with its own party and campaign. */
    file: 'src/bands/BandReporter.ts',
    find: '      const choice = this.ports.campaign(subject.tokenUuid);',
    replace: "      const choice = this.ports.campaign('');",
    defect:
      'a band is posted to the campaign of some other encounter than the one its creature is fighting in',
    tests: ['tests/unit/bandEncounters.test.ts'],
  },
];
