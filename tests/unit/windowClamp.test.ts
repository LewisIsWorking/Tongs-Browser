import { describe, expect, it } from 'vitest';

import {
  DEFAULT_UI_SCALE,
  MAX_UI_SCALE,
  MIN_UI_SCALE,
  normaliseScale,
} from '../../src/scaling/ScaleRegions.js';
import { clampWindow, needsClamping } from '../../src/scaling/WindowClamp.js';

const viewport = { width: 1000, height: 800 };

describe('clampWindow', () => {
  it('leaves a window that already fits untouched', () => {
    const rect = { left: 100, top: 100, width: 400, height: 300 };
    expect(clampWindow(rect, viewport)).toEqual(rect);
  });

  it('caps width at 95 percent and height at 90 percent of the viewport', () => {
    const clamped = clampWindow({ left: 0, top: 0, width: 5000, height: 5000 }, viewport);

    expect(clamped.width).toBe(950);
    expect(clamped.height).toBe(720);
  });

  /**
   * The failure this prevents is unrecoverable on a touch device: a sheet opening past the right
   * edge takes its header and close button with it, and there is no keyboard shortcut and nothing
   * left to drag.
   */
  it('pulls a window back when it hangs off the right edge', () => {
    const clamped = clampWindow({ left: 900, top: 100, width: 400, height: 300 }, viewport);
    expect(clamped.left).toBe(600);
  });

  it('pulls a window back when it hangs off the bottom edge', () => {
    const clamped = clampWindow({ left: 100, top: 700, width: 400, height: 300 }, viewport);
    expect(clamped.top).toBe(500);
  });

  it('pulls a window back from negative coordinates', () => {
    const clamped = clampWindow({ left: -200, top: -50, width: 400, height: 300 }, viewport);
    expect(clamped.left).toBe(0);
    expect(clamped.top).toBe(0);
  });

  /**
   * Order of operations, and the values are the whole point.
   *
   * Size is reduced first, to 950 by 720, and only then is position corrected against those new
   * dimensions, giving left 50 and top 80. Correcting position first would compute against the
   * original 5000 by 5000, where every candidate position is negative, and clamp to 0 by 0. So 50,
   * 80 rather than 0, 0 is the evidence that the order is right.
   */
  it('reduces size before correcting position', () => {
    const clamped = clampWindow({ left: 900, top: 700, width: 5000, height: 5000 }, viewport);

    expect(clamped).toEqual({ left: 50, top: 80, width: 950, height: 720 });
  });

  it('pins an oversized window to the top left rather than pushing it off the far edge', () => {
    const clamped = clampWindow({ left: 0, top: 0, width: 2000, height: 2000 }, viewport);

    expect(clamped.left).toBe(0);
    expect(clamped.top).toBe(0);
  });

  it('handles a viewport smaller than the window without producing negative coordinates', () => {
    const clamped = clampWindow(
      { left: 50, top: 50, width: 800, height: 600 },
      { width: 360, height: 640 }
    );

    expect(clamped.left).toBeGreaterThanOrEqual(0);
    expect(clamped.top).toBeGreaterThanOrEqual(0);
  });
});

describe('needsClamping', () => {
  it('reports false for a window that already fits', () => {
    expect(needsClamping({ left: 10, top: 10, width: 100, height: 100 }, viewport)).toBe(false);
  });

  it.each([
    ['too wide', { left: 0, top: 0, width: 5000, height: 100 }],
    ['off the right', { left: 990, top: 0, width: 100, height: 100 }],
    ['off the bottom', { left: 0, top: 790, width: 100, height: 100 }],
    ['negative left', { left: -1, top: 0, width: 100, height: 100 }],
  ])('reports true when the window is %s', (_label, rect) => {
    expect(needsClamping(rect, viewport)).toBe(true);
  });
});

describe('normaliseScale', () => {
  it('clamps below the minimum and above the maximum', () => {
    expect(normaliseScale(0.1)).toBe(MIN_UI_SCALE);
    expect(normaliseScale(5)).toBe(MAX_UI_SCALE);
  });

  it('snaps to the five percent step', () => {
    expect(normaliseScale(0.73)).toBe(0.75);
    expect(normaliseScale(0.71)).toBe(0.7);
  });

  /**
   * Without rounding, the value written back to settings and shown in the slider would be something
   * like 0.7300000000000001.
   */
  it('does not leak binary floating point noise', () => {
    for (let raw = MIN_UI_SCALE; raw <= MAX_UI_SCALE; raw += 0.01) {
      const value = normaliseScale(raw);
      expect(Number.isInteger(Math.round(value * 100))).toBe(true);
      expect(value.toString().length).toBeLessThanOrEqual(4);
    }
  });

  it('falls back to the default for a value that is not a number', () => {
    expect(normaliseScale(Number.NaN)).toBe(DEFAULT_UI_SCALE);
  });

  it('accepts the exact boundary values unchanged', () => {
    expect(normaliseScale(MIN_UI_SCALE)).toBe(MIN_UI_SCALE);
    expect(normaliseScale(MAX_UI_SCALE)).toBe(MAX_UI_SCALE);
  });
});
