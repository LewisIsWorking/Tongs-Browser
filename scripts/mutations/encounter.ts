import type { RecordedMutation } from './shape.ts';

/**
 * Encounter sync's mutations. Added 2026-09-16.
 *
 * Each is a rule whose loss still posts a tracker, only telling players what they cannot see, pinging the
 * wrong person, or posting without end.
 */
export const ENCOUNTER_MUTATIONS: readonly RecordedMutation[] = [
  {
    file: 'src/encounter/encounterSnapshot.ts',
    find: '      combatant.hidden === true ||',
    replace: '      false ||',
    defect:
      'a combatant the GM has hidden is listed in the combat topic, telling players it is there',
    tests: ['tests/unit/encounterSnapshot.test.ts'],
  },
  {
    file: 'src/encounter/encounterSnapshot.ts',
    find: '    const acted = index < turn;',
    replace: '    const acted = index <= turn;',
    defect:
      'the combatant whose turn it is now is struck off as having acted, so they are never pinged',
    tests: ['tests/unit/encounterSnapshot.test.ts'],
  },
  {
    file: 'src/encounter/encounterSnapshot.ts',
    find: '      enemies.push({ name: seen ? name : rules.mystifiedName, acted, ...rolled });',
    replace: '      enemies.push({ name, acted, ...rolled });',
    defect: "an enemy players only know as 'The creature' is named in the combat topic",
    tests: ['tests/unit/encounterSnapshot.test.ts'],
  },
  {
    file: 'src/encounter/EncounterSync.ts',
    find: '      this.ports.cancel(pending);',
    replace: '      void pending;',
    defect:
      'advancing one turn edits the Telegram tracker once per underlying update instead of once',
    tests: ['tests/unit/encounterSync.test.ts'],
  },
  {
    file: 'src/encounter/playerLinks.ts',
    find: "      return typeof chosen === 'string' && known.has(chosen) ? [[u.id, chosen]] : [];",
    replace: "      return typeof chosen === 'string' && chosen !== '' ? [[u.id, chosen]] : [];",
    defect:
      'a player is linked to a Telegram id the roster never offered, so the wrong person, or nobody, is pinged',
    tests: ['tests/unit/playerLinks.test.ts'],
  },
  {
    /* ⛔ Saving the tracker id is itself a combat update. */
    file: 'src/encounter/startEncounterSync.ts',
    find: "    if (on() && touches(changes, COMBAT_KEYS)) guard('on a turn', sync.changed(combat));",
    replace: "    if (on()) guard('on a turn', sync.changed(combat));",
    defect: 'saving the tracker id counts as a change, so the tracker is posted again and again',
    tests: ['tests/unit/encounterSyncWiring.test.ts'],
  },
  {
    /* 📜 Added 2026-09-17: the encounter's wiki page lists the initiative order. */
    file: 'src/encounter/encounterSnapshot.ts',
    find: "      typeof combatant.initiative === 'number' ? { initiative: combatant.initiative } : {};",
    replace: '      {};',
    defect: "an encounter's wiki page has no initiative order",
    tests: ['tests/unit/encounterWikiFields.test.ts'],
  },
  {
    file: 'src/encounter/encounterSnapshot.ts',
    find: "  const location = shown === undefined || shown === '' ? combat.scene?.name?.trim() : shown;",
    replace: '  const location = combat.scene?.name?.trim();',
    defect: "the public wiki names a scene by the GM's real name, which can spoil what is coming",
    tests: ['tests/unit/encounterWikiFields.test.ts'],
  },
];
