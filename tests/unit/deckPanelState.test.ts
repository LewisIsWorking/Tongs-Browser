import { describe, expect, it } from 'vitest';

import type { MessageFacts } from '../../src/deck/deckFacts.js';
import {
  choose,
  currentCard,
  initialState,
  step,
  toggleRoller,
  withCards,
} from '../../src/deck/panel/deckPanelState.js';

/**
 * Where the GM is in the roll deck. Written 2026-09-14.
 *
 * ⚠️ Each rule here is one a GM on a phone would feel break: being moved off a card by a new roll,
 * landing somewhere odd after applying, or confirming a choice made for a different card.
 */
const card = (id: string): MessageFacts => ({
  id,
  speaker: 'Goblin',
  title: null,
  timestamp: 1,
  damage: [],
  saves: [],
  target: null,
  handled: false,
});

const [a, b, c] = [card('a'), card('b'), card('c')];
const will = { statistic: 'will' as const, dc: 17, control: 'spell-save' as const, index: 0 };
const rollers = { kind: 'save-rollers' as const, saveIndex: 0, save: will, chosen: ['T1'] };

describe('re-reading the deck', () => {
  /** ⚠️ New rolls arriving must not move the GM off the card they are reading. */
  it('stays on the same card when it is still there', () => {
    const onB = step(initialState([a, b]), 1);

    const next = withCards(onB, [card('new'), a, b]);

    expect(currentCard(next)?.id).toBe('b');
  });

  /** The catch-up flow: applying the card on screen lands the GM on the one after it. */
  it('shows the next card when the current one dropped out', () => {
    const onB = step(initialState([a, b, c]), 1);

    expect(currentCard(withCards(onB, [a, c]))?.id).toBe('c');
  });

  it('falls back to the last card when the last one dropped out', () => {
    const onC = step(step(initialState([a, b, c]), 1), 1);

    expect(currentCard(withCards(onC, [a, b]))?.id).toBe('b');
  });

  it('has no card when the deck is empty', () => {
    const next = withCards(initialState([a]), []);

    expect(next.index).toBe(0);
    expect(currentCard(next)).toBeNull();
  });

  /** ⛔ Rollers chosen for one card must never be confirmed against another. */
  it('keeps a choice only while its card is still on screen', () => {
    const choosing = choose(initialState([a, b]), rollers);

    expect(withCards(choosing, [a, b]).choosing).toEqual(rollers);
    expect(withCards(choosing, [b]).choosing).toBeNull();
  });
});

describe('moving', () => {
  it('clamps at both ends, returning the same state', () => {
    const start = initialState([a, b]);

    expect(step(start, -1)).toBe(start);
    const end = step(start, 1);
    expect(step(end, 1)).toBe(end);
  });

  it('abandons a half-made choice and the old status', () => {
    const busy = { ...choose(initialState([a, b]), rollers), status: 'Done.' };

    const moved = step(busy, 1);

    expect(moved.choosing).toBeNull();
    expect(moved.status).toBeNull();
  });
});

describe('choosing rollers', () => {
  it('adds and removes a token', () => {
    const start = choose(initialState([a]), { ...rollers, chosen: [] });

    const one = toggleRoller(start, 'T1');
    const two = toggleRoller(one, 'T2');
    const back = toggleRoller(two, 'T1');

    expect(two.choosing).toEqual({ ...rollers, chosen: ['T1', 'T2'] });
    expect(back.choosing).toEqual({ ...rollers, chosen: ['T2'] });
  });

  it('does nothing outside a roller choice', () => {
    const picking = choose(initialState([a]), {
      kind: 'apply-target',
      option: { id: 'full', multiplier: 1, short: 'Apply' },
      amount: 6,
      types: ['fire'],
    });

    expect(toggleRoller(picking, 'T1')).toBe(picking);
  });

  it('clears the status when a choice starts', () => {
    const done = { ...initialState([a]), status: 'Done.' };

    expect(choose(done, rollers).status).toBeNull();
  });
});
