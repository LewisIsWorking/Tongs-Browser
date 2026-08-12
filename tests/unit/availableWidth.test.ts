import { describe, expect, it } from 'vitest';

import { availableWidthBesideSidebar, type SidebarBox } from '../../src/foundry/AvailableWidth.js';

/**
 * How much horizontal room there is before Foundry's sidebar.
 *
 * The other half of the sidebar avoidance in `BarClamp`: that one decides where the bar goes given a
 * width, this one decides what that width is. Every case below produces a bar squeezed against an
 * obstacle that is not there if it answers wrong, which reads as the module being broken rather than
 * as a layout subtlety.
 */
const VIEWPORT = 412;
const box = (overrides: Partial<SidebarBox> = {}): SidebarBox => ({
  width: 100,
  left: 312,
  right: 412,
  ...overrides,
});

describe('availableWidthBesideSidebar', () => {
  it('gives the whole viewport when there is no sidebar at all', () => {
    expect(availableWidthBesideSidebar(VIEWPORT, null)).toBe(VIEWPORT);
  });

  /** A small gap, so the bar does not sit flush against the sidebar edge. */
  it('stops just short of the sidebar rather than touching it', () => {
    expect(availableWidthBesideSidebar(VIEWPORT, box())).toBe(308);
  });

  /**
   * ⚠️ Foundry COLLAPSES the sidebar rather than removing it, so a collapsed sidebar is still an
   * element with a box. Treating it as an obstacle would shrink the bar to nothing for a user who
   * deliberately made room.
   */
  it('ignores a collapsed sidebar, which is still in the DOM with zero width', () => {
    expect(availableWidthBesideSidebar(VIEWPORT, box({ width: 0 }))).toBe(VIEWPORT);
  });

  /** Mid animation, or on a layout wider than the window. */
  it('ignores a sidebar entirely off the right edge', () => {
    expect(availableWidthBesideSidebar(VIEWPORT, box({ left: 412, right: 512 }))).toBe(VIEWPORT);
    expect(availableWidthBesideSidebar(VIEWPORT, box({ left: 500, right: 600 }))).toBe(VIEWPORT);
  });

  it('ignores a sidebar entirely off the left edge', () => {
    expect(availableWidthBesideSidebar(VIEWPORT, box({ left: -100, right: 0 }))).toBe(VIEWPORT);
    expect(availableWidthBesideSidebar(VIEWPORT, box({ left: -200, right: -100 }))).toBe(VIEWPORT);
  });

  /** A sidebar only just on screen still counts, since even a sliver overlaps the bar. */
  it('respects a sidebar that is only partly on screen', () => {
    expect(availableWidthBesideSidebar(VIEWPORT, box({ left: 400, right: 500 }))).toBe(396);
  });

  /**
   * ⚠️ Never negative. A sidebar hard against the left edge would otherwise return a negative width,
   * and a negative available width makes every clamp downstream nonsense.
   */
  it('never goes below zero', () => {
    expect(availableWidthBesideSidebar(VIEWPORT, box({ left: 2, right: 102 }))).toBe(0);
    expect(availableWidthBesideSidebar(VIEWPORT, box({ left: 0.5, right: 100 }))).toBe(0);
  });
});
