import { describe, expect, it } from 'vitest';

import { SWIPE_DISTANCE, readSwipe } from '../../src/deck/panel/deckSwipe.js';

/**
 * Reading a swipe from where a finger started and lifted. Written 2026-09-14.
 */
const at = (x: number, y = 400) => ({ x, y });

describe('which way a swipe goes', () => {
  it('a finger moving left is the next card', () => {
    expect(readSwipe(at(300), at(100))).toBe(1);
  });

  it('a finger moving right is the previous card', () => {
    expect(readSwipe(at(100), at(300))).toBe(-1);
  });
});

describe('what is not a swipe', () => {
  it('a tap, or a nudge shorter than the distance', () => {
    expect(readSwipe(at(200), at(200))).toBeNull();
    expect(readSwipe(at(200), at(200 - (SWIPE_DISTANCE - 1)))).toBeNull();
  });

  it('counts from exactly the distance', () => {
    expect(readSwipe(at(200), at(200 - SWIPE_DISTANCE))).toBe(1);
  });

  /** ⛔ Scrolling a tall card must never turn it: sideways has to be twice the vertical travel. */
  it('a scroll that drifts sideways', () => {
    expect(readSwipe(at(200, 600), at(120, 400))).toBeNull();
    expect(readSwipe(at(200, 600), at(100, 550))).toBe(1);
  });
});
