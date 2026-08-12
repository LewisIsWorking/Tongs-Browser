import { describe, expect, it } from 'vitest';

import { continuesPreviousTap, type TapWindowConfig } from '../../src/gesture/TapWindow.js';

/**
 * Whether a new touch belongs to the tap before it.
 *
 * ⚠️ This does NOT decide between a double tap and a tap then hold drag. Both begin identically: a
 * tap, a lift, and a second touch soon after and close by. Only the DURATION of that second touch
 * tells them apart, so the same state covers both and the timer decides. All this answers is the
 * narrower question of whether the two touches are related at all.
 */
const finger = (clientX: number, clientY: number) => ({ id: 1, clientX, clientY });
const config: TapWindowConfig = { doubleTapWindowMs: 300, doubleTapSlopPx: 20 };
const tap = { at: 1000, x: 100, y: 200 };

describe('continuesPreviousTap', () => {
  it('is true soon after, and close by', () => {
    expect(continuesPreviousTap(finger(105, 205), 1200, tap, config)).toBe(true);
  });

  it('is false when there was no previous tap', () => {
    expect(continuesPreviousTap(finger(100, 200), 1200, null, config)).toBe(false);
  });

  /**
   * ⚠️ Time alone would join a tap here to a tap across the screen a moment later, which is two
   * separate intentions rather than one gesture.
   */
  it('is false for a touch that is quick but far away', () => {
    expect(continuesPreviousTap(finger(400, 200), 1100, tap, config)).toBe(false);
  });

  /**
   * ⚠️ Distance alone would join a tap to one in the same place a minute later, which is somebody
   * returning to a control they already used.
   */
  it('is false for a touch in the same place but far too late', () => {
    expect(continuesPreviousTap(finger(100, 200), 5000, tap, config)).toBe(false);
  });

  it('includes both boundaries, so a touch exactly on the limit still counts', () => {
    expect(continuesPreviousTap(finger(120, 200), 1300, tap, config)).toBe(true);
  });

  it('excludes a touch just past either limit', () => {
    expect(continuesPreviousTap(finger(100, 200), 1301, tap, config)).toBe(false);
    expect(continuesPreviousTap(finger(121, 200), 1200, tap, config)).toBe(false);
  });

  /** The slop is a radius, not a bounding box, so diagonal movement is measured properly. */
  it('measures distance as a radius rather than per axis', () => {
    // 15 on each axis is 21.2 apart, past a slop of 20, though neither axis alone exceeds it.
    expect(continuesPreviousTap(finger(115, 215), 1100, tap, config)).toBe(false);
  });
});
