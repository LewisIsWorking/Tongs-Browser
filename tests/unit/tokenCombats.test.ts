import { describe, expect, it } from 'vitest';

import { allCombatants, combatsWithToken } from '../../src/automation/tokenCombats.js';

/**
 * Found live on Forge, 2026-09-15: four encounters ran at once, and a hit in the one the tracker was not
 * showing was treated as out of combat.
 */
const encounter = (id: string, started: boolean, ...tokens: [string, string?][]) => ({
  id,
  started,
  combatants: {
    contents: tokens.map(([tokenId, sceneId]) =>
      sceneId === undefined ? { tokenId } : { tokenId, sceneId }
    ),
  },
});
const world = {
  game: {
    combats: {
      contents: [
        encounter('one', true, ['Kibwe', 'S1']),
        encounter('prepared', false, ['Tiny', 'S9']),
        encounter('four', true, ['Changer', 'S9'], ['Tiny', 'S9']),
      ],
    },
  },
};

describe('the encounters a token is in', () => {
  it('searches every encounter, and puts a started one before one still being prepared', () => {
    expect(combatsWithToken(world, 'S9', 'Tiny').map((c) => c.id)).toEqual(['four', 'prepared']);
    expect(combatsWithToken(world, 'S1', 'Kibwe').map((c) => c.id)).toEqual(['one']);
  });

  it('matches the scene as well as the token id, and reads a combatant with no scene by id', () => {
    expect(combatsWithToken(world, 'S1', 'Tiny')).toEqual([]);
    const sceneless = { game: { combats: { contents: [encounter('old', true, ['Tiny'])] } } };
    expect(combatsWithToken(sceneless, 'S9', 'Tiny').map((c) => c.id)).toEqual(['old']);
  });

  it('finds nothing in a world with no encounters', () => {
    expect(combatsWithToken({ game: { combats: null } }, 'S', 'T')).toEqual([]);
    expect(allCombatants({})).toEqual([]);
    expect(allCombatants({ game: { combats: { contents: [{ id: 'empty' }] } } })).toEqual([]);
  });
});
