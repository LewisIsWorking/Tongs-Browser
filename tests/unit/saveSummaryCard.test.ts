import { describe, expect, it } from 'vitest';

import type { TokenView } from '../../src/bands/bandSubject.js';
import { bandWord } from '../../src/bands/healthBands.js';
import {
  popupFor,
  summaryHtml,
  summaryLine,
  summaryTarget,
  summaryText,
} from '../../src/automation/saveSummaryCard.js';

/**
 * The saves card Lewis asked for on 2026-10-07: "not saying what the numerical result was, just the stage
 * success ... and the same information as posted to telegram such as health bands".
 */
const RULES = { nameVisibility: true, mystifiedName: 'The creature' };
const kreski: TokenView = {
  tokenUuid: 'Scene.S.Token.K',
  name: 'Kreski',
  hidden: false,
  playersCanSeeName: true,
  hp: 2,
  maxHp: 16,
  traits: [],
  ally: false,
  inCombat: true,
  unseen: false,
  image: null,
};
const STAGGERED = { segments: 2, word: bandWord('living', 2) };

describe('who the card names, and whose band it shows', () => {
  it('names an enemy as Telegram does, with its band', () => {
    expect(summaryTarget(kreski, RULES)).toEqual({ name: 'Kreski', band: STAGGERED });
    expect(summaryTarget({ ...kreski, playersCanSeeName: false }, RULES)).toEqual({
      name: 'The creature',
      band: STAGGERED,
    });
  });

  it('names an ally but keeps its band off, and never names what the players cannot see', () => {
    expect(summaryTarget({ ...kreski, ally: true, playersCanSeeName: false }, RULES)).toEqual({
      name: 'Kreski',
      band: null,
    });
    for (const view of [{ ...kreski, hidden: true }, { ...kreski, unseen: true }, null]) {
      expect(summaryTarget(view, RULES)).toEqual({ name: 'The creature', band: null });
    }
    expect(
      summaryTarget({ ...kreski, inCombat: false }, { ...RULES, nameVisibility: false })
    ).toEqual({ name: 'Kreski', band: null });
  });
});

describe('what the card says', () => {
  const target = { name: 'Kreski', outcome: 'success', taken: null, band: STAGGERED };

  it('gives each degree in words, and no number anywhere', () => {
    const words = ['criticalSuccess', 'success', 'failure', 'criticalFailure', 'constructor'].map(
      (outcome) => summaryLine({ ...target, outcome })
    );
    expect(words).toEqual([
      'Kreski: Critical success',
      'Kreski: Success',
      'Kreski: Failure',
      'Kreski: Critical failure',
      'Kreski: Rolled',
    ]);
    expect(words.join()).not.toMatch(/\d/);
  });

  it('adds the damage taken and the band once the damage lands', () => {
    expect(summaryLine({ ...target, taken: 'half' })).toBe(
      `Kreski: Success, half damage. ▰▰▱▱▱▱▱▱▱▱ ${STAGGERED.word}`
    );
    expect(summaryLine({ ...target, outcome: 'criticalSuccess', taken: 'none', band: null })).toBe(
      'Kreski: Critical success, no damage'
    );
  });

  it('escapes names in the card, and lists every target in the pop-up', () => {
    const card = {
      spellName: 'Daze <b>',
      targets: [
        { ...target, name: '<i>Kreski</i>' },
        { ...target, outcome: 'failure' },
      ],
    };
    const html = summaryHtml(card);
    expect(html).toContain('Saves against Daze &#60;b&#62;');
    expect(html).not.toContain('<i>');
    expect(summaryText(card)).toBe(
      'Tongs rolled the saves against Daze <b>. <i>Kreski</i>: Success; Kreski: Failure.'
    );
  });
});

describe("the caster's pop-up", () => {
  const card = (casterUserId: string | null) => ({
    flags: {
      'tongs-browser': { saveSummary: { castId: 'c1', casterUserId, text: 'hi', taken: null } },
    },
  });

  it('shows only in the browser of the user who cast the spell', () => {
    expect(popupFor(card('player'), 'tongs-browser', 'player')).toBe('hi');
    expect(popupFor(card('player'), 'tongs-browser', 'gm')).toBeNull();
    expect(popupFor(card(null), 'tongs-browser', null)).toBeNull();
    expect(
      popupFor({ flags: { 'tongs-browser': { saveSummary: {} } } }, 'tongs-browser', 'p')
    ).toBeNull();
    expect(popupFor({}, 'tongs-browser', 'player')).toBeNull();
  });
});
