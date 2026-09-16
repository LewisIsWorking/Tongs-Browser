import { describe, expect, it } from 'vitest';

import { readEncounter } from '../../src/encounter/encounterSnapshot.js';
import type { CombatantLike } from '../../src/encounter/encounterSnapshot.js';

/**
 * A Foundry encounter read into side phases for the combat topic's tracker. Written 2026-09-16; the model
 * was decided with Lewis.
 */
const RULES = { nameVisibility: true, mystifiedName: 'The creature' };
const pc = (name: string, owner: string, overrides: CombatantLike = {}): CombatantLike => ({
  name,
  token: { name, playersCanSeeName: true },
  actor: { hasPlayerOwner: true, ownership: { default: 0, gm: 3, [owner]: 3 } },
  ...overrides,
});
const foe = (name: string, overrides: CombatantLike = {}): CombatantLike => ({
  name,
  token: { name, playersCanSeeName: true },
  actor: { hasPlayerOwner: false, alliance: 'opposition' },
  ...overrides,
});
const LINKS = { ryo: '111', bella: '222' };

describe('an encounter as the tracker shows it', () => {
  it('splits allies from enemies, marks whose turn has passed, and names each linked player', () => {
    const turns = [
      pc('Arktos', 'ryo'),
      foe('Captain Vex'),
      pc('Diabla', 'bella'),
      pc('Reign', 'nobody'),
    ];

    expect(readEncounter({ id: 'c1', round: 2, turn: 2, turns }, LINKS, RULES)).toEqual({
      encounterId: 'c1',
      round: 2,
      allies: [
        { name: 'Arktos', acted: true, telegramUserId: '111' },
        { name: 'Diabla', acted: false, telegramUserId: '222' },
        { name: 'Reign', acted: false },
      ],
      enemies: [{ name: 'Captain Vex', acted: true }],
      ended: false,
    });
  });

  it('counts a party-alliance creature as an ally, and a GM owner never as a player', () => {
    const summon = foe('Eidolon', { actor: { alliance: 'party', ownership: { gm: 3 } } });
    const read = readEncounter(
      { id: 'c1', round: 1, turn: 0, turns: [summon] },
      { gm: '999' },
      RULES
    );
    expect(read?.allies).toEqual([{ name: 'Eidolon', acted: false, telegramUserId: '999' }]);
    expect(
      readEncounter({ id: 'c1', round: 1, turn: 0, turns: [pc('Kitt', 'ryo')] }, {}, RULES)?.allies
    ).toEqual([{ name: 'Kitt', acted: false }]);
  });

  /* ⛔ Players are told only what they can see. */
  it('leaves out hidden and defeated combatants, and names an enemy only as players may see it', () => {
    const turns = [
      foe('Assassin', { hidden: true }),
      foe('Lurker', { token: { name: 'Lurker', hidden: true } }),
      foe('Dead goblin', { defeated: true }),
      foe('Nameless horror', { token: { name: 'Nameless horror', playersCanSeeName: false } }),
    ];
    expect(readEncounter({ id: 'c1', round: 1, turn: 0, turns }, {}, RULES)?.enemies).toEqual([
      { name: 'The creature', acted: false },
    ]);
    expect(
      readEncounter({ id: 'c1', round: 1, turn: 0, turns }, {}, { ...RULES, nameVisibility: false })
        ?.enemies
    ).toEqual([{ name: 'Nameless horror', acted: false }]);
  });

  it('has nobody acted before the encounter starts, and reads nothing without an id', () => {
    const turns = [pc('Arktos', 'ryo'), foe('Vex')];
    const before = readEncounter({ id: 'c1', round: 0, turn: 5, turns }, LINKS, RULES);
    expect([...(before?.allies ?? []), ...(before?.enemies ?? [])].every((c) => !c.acted)).toBe(
      true
    );
    expect(
      readEncounter(
        { id: 'c1', round: 1, turn: null, turns: [foe('Vex', { name: null, token: null })] },
        {},
        { ...RULES, nameVisibility: false }
      )
    ).toMatchObject({ enemies: [{ name: '', acted: false }] });
    expect(readEncounter({ id: 'c1' }, {}, RULES, true)).toMatchObject({
      round: 0,
      ended: true,
      allies: [],
    });
    expect(readEncounter({ round: 1, turns }, LINKS, RULES)).toBeNull();
  });
});
