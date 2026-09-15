import { describe, expect, it } from 'vitest';

import { readBandSubject } from '../../src/bands/bandSubject.js';
import type { TokenView } from '../../src/bands/bandSubject.js';

/**
 * Which tokens players may hear about, and under what name. Written 2026-09-14.
 */
const goblin = (overrides: Partial<TokenView> = {}): TokenView => ({
  tokenUuid: 'Scene.S.Token.G',
  name: 'Goblin Warchief',
  hidden: false,
  playersCanSeeName: true,
  hp: 17,
  maxHp: 28,
  traits: ['goblin', 'humanoid'],
  ally: false,
  inCombat: true,
  unseen: false,
  image: 'https://assets.forge-vtt.com/u/goblin.webp',
  ...overrides,
});
const RULES = { nameVisibility: true, mystifiedName: 'The creature' };

describe('a band players may see', () => {
  it('reads a visible enemy in combat into its band', () => {
    expect(readBandSubject(goblin(), RULES)).toEqual({
      tokenUuid: 'Scene.S.Token.G',
      name: 'Goblin Warchief',
      segments: 7,
      word: 'Bruised',
      hp: 17,
      maxHp: 28,
      image: 'https://assets.forge-vtt.com/u/goblin.webp',
    });
    expect(readBandSubject(goblin({ hp: -4, traits: ['construct'] }), RULES)).toMatchObject({
      segments: 0,
      word: 'Destroyed',
      hp: 0,
    });
  });

  it("uses PF2e's own name rule: the real name only when players can see it", () => {
    expect(readBandSubject(goblin({ playersCanSeeName: false }), RULES)?.name).toBe('The creature');
    expect(
      readBandSubject(goblin({ playersCanSeeName: false }), { ...RULES, nameVisibility: false })
        ?.name
    ).toBe('Goblin Warchief');
  });

  /* ⛔ A picture of "The creature" would tell players what it is. */
  it("sends the creature's picture only when players can see its name", () => {
    expect(readBandSubject(goblin({ playersCanSeeName: false }), RULES)?.image).toBeNull();
    expect(
      readBandSubject(goblin({ playersCanSeeName: false }), { ...RULES, nameVisibility: false })
        ?.image
    ).toBe('https://assets.forge-vtt.com/u/goblin.webp');
  });

  it('tells players nothing about an ally, a hidden or unseen token, one out of combat, or no max HP', () => {
    for (const overrides of [
      { ally: true },
      { hidden: true },
      { unseen: true },
      { inCombat: false },
      { maxHp: 0 },
    ]) {
      expect(readBandSubject(goblin(overrides), RULES)).toBeNull();
    }
  });
});
