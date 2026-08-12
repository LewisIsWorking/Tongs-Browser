import { describe, expect, it } from 'vitest';

import { clampBarPosition, type ClampInput } from '../../src/modifiers/BarClamp.js';

/**
 * Keeping the modifier bar on screen AND off Foundry's sidebar.
 *
 * ⚠️ These cases are unreachable from the DOM suite. jsdom reports `offsetWidth` as 0 for every
 * element, so every clamp it runs is against a zero sized bar where the maths degenerates and all of
 * the branches below collapse to the same answer. This is the only place the behaviour is checked.
 */
const clamp = (overrides: Partial<ClampInput> = {}) =>
  clampBarPosition({
    desired: { x: 88, y: 120 },
    barWidth: 324,
    barHeight: 40,
    availableWidth: undefined,
    viewport: { width: 412, height: 915 },
    ...overrides,
  });

describe('clampBarPosition', () => {
  it('leaves a position that already fits alone', () => {
    expect(clamp().position).toEqual({ x: 88, y: 120 });
  });

  it('never lets the bar go off the top or the left', () => {
    expect(clamp({ desired: { x: -50, y: -10 } }).position).toEqual({ x: 0, y: 0 });
  });

  it('pulls the bar back from the right and bottom edges', () => {
    const result = clamp({ desired: { x: 9999, y: 9999 } });

    // 412 wide viewport, 324 wide bar, so the furthest right it may sit is 88.
    expect(result.position).toEqual({ x: 88, y: 875 });
  });

  /**
   * ⚠️ The ADR 0008 bug on the other side of the screen. Measured 2026-08-11 on a 412px phone: once
   * the bar wraps it reaches the right edge, where Foundry's sidebar lives, and the shipped default
   * covered the sidebar's icon column between y 120 and 250. That is worse than covering anything
   * else, because the sidebar is how the user reaches chat, actors and the rest of Foundry.
   */
  it('keeps out of the sidebar, not merely out of the window', () => {
    const result = clamp({ availableWidth: 300, barWidth: 250 });

    expect(result.position.x).toBe(50);
    expect(result.maxWidth).toBe(250);
  });

  /**
   * ⚠️ Trading a covered sidebar for a bar hanging off the screen is not a fix. A bar wider than the
   * room beside the sidebar has NO correct position, so the least wrong answer is the one where all
   * of it is still reachable.
   */
  it('falls back to the whole window when the bar cannot fit beside the sidebar', () => {
    const result = clamp({ availableWidth: 200, barWidth: 324, desired: { x: 88, y: 0 } });

    expect(result.position.x).toBe(88);
    // 412 - 324 = 88, the full window rather than the 200 that would have pushed it off the left.
    expect(result.maxWidth).toBe(412 - 88);
  });

  describe('the width cap', () => {
    /**
     * ⚠️ Position alone cannot fix this, which is why the result carries a width at all.
     *
     * The bar is `position: fixed` with only `left` set, so it is shrink to fit: its used width is
     * min(max-content, max-width, viewport - left). Moving it LEFT makes it WIDER and its right edge
     * stays pinned to the viewport edge. Measured on a 412px phone: clamping x from 88 to 65 changed
     * the width from 324 to 347 while the right edge stayed at 412.
     */
    it('caps the width so the right edge lands on the available width', () => {
      const result = clamp({ availableWidth: 350, barWidth: 200, desired: { x: 65, y: 0 } });

      expect(result.position.x + result.maxWidth).toBe(350);
    });

    /** Computed from the CLAMPED x, not the desired one, so one pass is enough. */
    it('is measured from where the bar ended up, not where it asked to be', () => {
      const result = clamp({ availableWidth: 300, barWidth: 250, desired: { x: 9999, y: 0 } });

      expect(result.position.x).toBe(50);
      expect(result.maxWidth).toBe(250);
      expect(result.position.x + result.maxWidth).toBe(300);
    });

    it('never goes negative', () => {
      expect(clamp({ availableWidth: 10, barWidth: 5, desired: { x: 9999, y: 0 } }).maxWidth).toBe(
        5
      );
    });
  });

  /**
   * Zero before layout. The clamp must be a no op then, or the bar is dragged to the origin on every
   * render that happens to run before the browser has measured it.
   */
  it('leaves the position untouched when the bar has not been laid out yet', () => {
    const result = clamp({ barWidth: 0, barHeight: 0, desired: { x: 88, y: 120 } });

    expect(result.position).toEqual({ x: 88, y: 120 });
  });

  it('uses the full window when no available width is supplied', () => {
    const withNothing = clamp({ availableWidth: undefined, desired: { x: 9999, y: 0 } });
    const withWindow = clamp({ availableWidth: 412, desired: { x: 9999, y: 0 } });

    expect(withNothing).toEqual(withWindow);
  });
});
