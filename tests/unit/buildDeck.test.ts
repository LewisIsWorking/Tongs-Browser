import { describe, expect, it } from 'vitest';

import { buildDeck, isActionable } from '../../src/deck/buildDeck.js';
import type { MessageFacts } from '../../src/deck/deckFacts.js';

/**
 * Which messages are GM roll deck cards, and in what order. Written 2026-09-13.
 *
 * ⚠️ Each rule was decided with Lewis rather than chosen here, so each test names the decision it pins:
 * only actionable cards, handled cards drop out, oldest unhandled first.
 */
const message = (overrides: Partial<MessageFacts> = {}): MessageFacts => ({
  id: 'm',
  speaker: 'Goblin',
  title: null,
  timestamp: 1000,
  damage: [],
  saves: [],
  target: null,
  handled: false,
  ...overrides,
});

const fire = [{ rollIndex: 0, total: 12, types: ['fire'], amounts: { full: 12 } }];
const reflex = [{ statistic: 'reflex' as const, dc: 20, control: 'spell-save' as const, index: 0 }];

describe('which messages are cards', () => {
  it('counts a message with damage', () => {
    expect(isActionable(message({ damage: fire }))).toBe(true);
  });

  it('counts a message asking for a save', () => {
    expect(isActionable(message({ saves: reflex }))).toBe(true);
  });

  /** ⚠️ Decided: chat, emotes and rolls with nothing to act on never appear. */
  it('does not count a message with neither', () => {
    expect(isActionable(message())).toBe(false);
    expect(buildDeck([message()])).toEqual([]);
  });
});

describe('handled cards', () => {
  /**
   * ⛔ Decided: handled cards drop out, read from the marker phase 2's automation also checks. A deck
   * that kept them would let the GM apply the same hit twice.
   */
  it('leaves out a card already handled', () => {
    const deck = buildDeck([
      message({ id: 'done', damage: fire, handled: true }),
      message({ id: 'todo', damage: fire }),
    ]);

    expect(deck.map((card) => card.id)).toEqual(['todo']);
  });

  it('is empty when everything is handled', () => {
    expect(buildDeck([message({ damage: fire, handled: true })])).toEqual([]);
  });
});

describe('order', () => {
  /** ⚠️ Decided: oldest unhandled first, for catching up on a play-by-post thread. */
  it('puts the oldest card first whatever order the messages arrive in', () => {
    const deck = buildDeck([
      message({ id: 'late', timestamp: 3000, damage: fire }),
      message({ id: 'early', timestamp: 1000, damage: fire }),
      message({ id: 'mid', timestamp: 2000, damage: fire }),
    ]);

    expect(deck.map((card) => card.id)).toEqual(['early', 'mid', 'late']);
  });

  /**
   * ⚠️ A damage roll can land in the same millisecond as the attack that caused it. Ties break on id
   * so the deck opens in the same order every time rather than shuffling the cards between opens.
   */
  it('breaks a timestamp tie by id, the same way every time', () => {
    const same = [
      message({ id: 'b', damage: fire }),
      message({ id: 'a', damage: fire }),
      message({ id: 'c', damage: fire }),
    ];

    expect(buildDeck(same).map((card) => card.id)).toEqual(['a', 'b', 'c']);
    expect(buildDeck([...same].reverse()).map((card) => card.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps a card listed twice as two cards, rather than dropping one', () => {
    const twice = [message({ id: 'a', damage: fire }), message({ id: 'a', damage: fire })];

    expect(buildDeck(twice)).toHaveLength(2);
  });

  /** ⛔ The caller's list is Foundry's own collection order, which the chat log also reads. */
  it('never reorders the list it was given', () => {
    const given = [
      message({ id: 'late', timestamp: 3000, damage: fire }),
      message({ id: 'early', timestamp: 1000, damage: fire }),
    ];

    buildDeck(given);

    expect(given.map((card) => card.id)).toEqual(['late', 'early']);
  });
});
