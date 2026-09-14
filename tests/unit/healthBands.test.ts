import { describe, expect, it } from 'vitest';

import { BAND_WORDS, bandWord, creatureKind, segmentsFor } from '../../src/bands/healthBands.js';

/**
 * Health bands: segments, which words fit which creature, and the approved words. Written 2026-09-14.
 */
describe('segments', () => {
  it('rounds up to a tenth of max HP, with exactly 50% always in segment 5', () => {
    expect(segmentsFor(28, 28)).toBe(10);
    expect(segmentsFor(26, 28)).toBe(10);
    expect(segmentsFor(25, 28)).toBe(9);
    expect(segmentsFor(14, 28)).toBe(5);
    expect(segmentsFor(50, 100)).toBe(5);
    expect(segmentsFor(51, 100)).toBe(6);
    expect(segmentsFor(1, 500)).toBe(1);
  });

  it('keeps down apart from 1 HP, and reads nonsense as down or full', () => {
    expect(segmentsFor(0, 28)).toBe(0);
    expect(segmentsFor(-3, 28)).toBe(0);
    expect(segmentsFor(5, 0)).toBe(0);
    expect(segmentsFor(40, 28)).toBe(10);
  });

  /* ⚠️ Every exact boundary, so rounding the wrong way (down, or to nearest) shows up somewhere. */
  it('lands every exact tenth in its own segment for any max HP up to 1000', () => {
    for (let max = 10; max <= 1000; max += 10) {
      for (let tenth = 1; tenth <= 10; tenth += 1) {
        expect(segmentsFor((max / 10) * tenth, max)).toBe(tenth);
      }
    }
  });
});

describe('which words', () => {
  it('fits the words to the creature, the more specific trait winning', () => {
    expect(creatureKind(['humanoid', 'goblin'])).toBe('living');
    expect(creatureKind(['construct', 'mindless'])).toBe('construct');
    expect(creatureKind(['robot'])).toBe('construct');
    expect(creatureKind(['android', 'humanoid', 'tech'])).toBe('living');
    expect(creatureKind(['undead', 'skeleton'])).toBe('undead');
    expect(creatureKind(['undead', 'incorporeal', 'spirit'])).toBe('incorporeal');
    expect(creatureKind(['ooze', 'construct'])).toBe('ooze');
    expect(creatureKind(['construct', 'undead'])).toBe('undead');
  });

  it('uses the approved words, down first', () => {
    expect(bandWord('living', 6)).toBe('Bloodied');
    expect(bandWord('construct', 5)).toBe('Sparking');
    expect(bandWord('undead', 3)).toBe('Falling apart');
    expect(bandWord('ooze', 2)).toBe('Puddling');
    expect(bandWord('incorporeal', 10)).toBe('Vivid');
    expect(bandWord('living', 0)).toBe('Down');
    expect(bandWord('incorporeal', 0)).toBe('Dispersed');
    expect(bandWord('living', 12)).toBe('Unhurt');
    expect(bandWord('living', -1)).toBe('Down');
    for (const words of Object.values(BAND_WORDS)) {
      expect(words).toHaveLength(11);
      expect(new Set(words).size).toBe(11);
    }
  });
});
