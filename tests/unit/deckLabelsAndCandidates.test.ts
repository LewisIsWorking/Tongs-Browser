import { describe, expect, it } from 'vitest';

import {
  chooseRollersLabel,
  listNames,
  positionLabel,
  rollLabel,
} from '../../src/deck/panel/deckLabels.js';
import { readTokenCandidates } from '../../src/deck/panel/tokenCandidates.js';
import type { CandidateGlobals } from '../../src/deck/panel/tokenCandidates.js';

/**
 * What the deck's save buttons say, and who a GM can choose. Written 2026-09-14.
 */
const will = { statistic: 'will' as const, dc: 17, control: 'spell-save' as const, index: 0 };

describe('save labels name what the tap does', () => {
  it('names the save and its DC', () => {
    expect(chooseRollersLabel(will)).toBe('Choose who rolls Will DC 17');
    expect(chooseRollersLabel({ ...will, statistic: 'reflex', dc: null })).toBe(
      'Choose who rolls Reflex save'
    );
  });

  it('names every roller on the confirm button', () => {
    const goblins = [
      { tokenUuid: 'a', name: 'Goblin' },
      { tokenUuid: 'b', name: 'Orc' },
      { tokenUuid: 'c', name: 'Troll' },
    ];

    expect(rollLabel(will, goblins)).toBe('Roll Will DC 17 for Goblin, Orc and Troll');
  });

  it('says what is missing before anyone is chosen', () => {
    expect(rollLabel({ ...will, statistic: 'fortitude' }, [])).toBe(
      'Tap each creature that rolls Fortitude DC 17'
    );
  });

  it('lists one and two names without a stray separator', () => {
    expect(listNames([])).toBe('');
    expect(listNames(['Goblin'])).toBe('Goblin');
    expect(listNames(['Goblin', 'Orc'])).toBe('Goblin and Orc');
  });

  it('says where the GM is, or that there is nothing', () => {
    expect(positionLabel(1, 5)).toBe('Card 2 of 5');
    expect(positionLabel(0, 0)).toBe('Nothing to apply or roll');
  });
});

describe('who a GM can choose', () => {
  const token = (uuid: string, name: string) => ({ uuid, name });
  const world = (overrides: Partial<CandidateGlobals> = {}, isGM = true): CandidateGlobals => ({
    game: { user: { isGM } },
    canvas: {
      scene: { id: 'S1' },
      tokens: {
        placeables: [
          { document: token('Scene.S1.Token.A', 'Goblin') },
          { document: token('Scene.S1.Token.B', 'Orc') },
        ],
      },
    },
    ...overrides,
  });

  it('offers every token on the viewed scene with no combat', () => {
    expect(readTokenCandidates(world()).map((c) => c.name)).toEqual(['Goblin', 'Orc']);
  });

  /** ⛔ Token names can be hidden from players; this list is the GM's alone. */
  it('offers a player nobody', () => {
    expect(readTokenCandidates(world({}, false))).toEqual([]);
  });

  it("offers the encounter's combatants when a combat runs on this scene", () => {
    const combat = {
      scene: { id: 'S1' },
      combatants: { contents: [{ token: token('Scene.S1.Token.B', 'Orc') }, { token: null }] },
    };

    const candidates = readTokenCandidates({ ...world(), game: { user: { isGM: true }, combat } });

    expect(candidates).toEqual([{ tokenUuid: 'Scene.S1.Token.B', name: 'Orc' }]);
  });

  it('ignores a combat on another scene, or one with no tokens', () => {
    const elsewhere = {
      scene: { id: 'S2' },
      combatants: { contents: [{ token: token('x', 'X') }] },
    };
    const empty = { scene: { id: 'S1' }, combatants: { contents: [] } };

    for (const combat of [elsewhere, empty]) {
      const names = readTokenCandidates({ ...world(), game: { user: { isGM: true }, combat } });
      expect(names.map((c) => c.name)).toEqual(['Goblin', 'Orc']);
    }
  });

  it('skips a token without a uuid or name, and lists a token once', () => {
    const messy = world({
      canvas: {
        scene: { id: 'S1' },
        tokens: {
          placeables: [
            { document: token('Scene.S1.Token.A', 'Goblin') },
            { document: token('Scene.S1.Token.A', 'Goblin') },
            { document: { name: 'No uuid' } },
            {},
          ],
        },
      },
    });

    expect(readTokenCandidates(messy)).toEqual([{ tokenUuid: 'Scene.S1.Token.A', name: 'Goblin' }]);
  });

  it('offers nobody with no canvas', () => {
    expect(readTokenCandidates({ game: { user: { isGM: true } } })).toEqual([]);
  });
});
