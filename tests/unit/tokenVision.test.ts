import { describe, expect, it } from 'vitest';

import { DEFAULT_VISION_ANGLE, visionChange } from '../../src/facing/tokenVision.js';

/**
 * Default token vision, 2026-11-18: every token's vision on, at 160 degrees unless an angle was chosen.
 */
describe("a token's vision", () => {
  it('is 160 degrees', () => {
    expect(DEFAULT_VISION_ANGLE).toBe(160);
  });

  it("turns on at 160 when off, unset, or at Foundry's full circle", () => {
    const on160 = { sight: { enabled: true, angle: 160 } };
    expect(visionChange(undefined)).toEqual(on160);
    expect(visionChange({})).toEqual(on160);
    expect(visionChange({ sight: { enabled: false, angle: 360 } })).toEqual(on160);
    expect(visionChange({ sight: { enabled: true, angle: 360 } })).toEqual(on160);
  });

  it('keeps an angle someone chose, only switching vision on', () => {
    expect(visionChange({ sight: { enabled: false, angle: 90 } })).toEqual({
      sight: { enabled: true, angle: 90 },
    });
    expect(visionChange({ sight: { enabled: true, angle: 90 } })).toBeNull();
  });

  it('is left alone when already on at 160', () => {
    expect(visionChange({ sight: { enabled: true, angle: 160 } })).toBeNull();
  });
});
