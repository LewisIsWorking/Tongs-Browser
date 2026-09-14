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
    find: "    if (this.ports.role() !== 'act' || hp?.value === undefined || campaign === '') {",
    replace: "    if (hp?.value === undefined || campaign === '') {",
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
    replace: '  return Math.min(10, Math.ceil((Math.min(hp, max) / max) * 10));',
    defect: 'an exact tenth of max HP lands one band too high for some creatures',
    tests: ['tests/unit/healthBands.test.ts'],
  },
];
