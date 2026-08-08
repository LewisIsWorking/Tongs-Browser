import { describe, expect, it } from 'vitest';

import {
  IDENTITY_TRANSFORM,
  createScaleTransform,
  isIdentity,
  toScaledSpace,
  toViewportSpace,
} from '../../src/pointer/CoordinateTransform.js';

/**
 * The brief calls this the single most likely source of "the cursor is visually here but the click
 * lands there", so it is tested at the three scales the UI scaling layer actually uses, and the
 * round trip property is checked rather than just individual values.
 */
describe('CoordinateTransform', () => {
  describe('identity', () => {
    it('recognises the identity transform', () => {
      expect(isIdentity(IDENTITY_TRANSFORM)).toBe(true);
      expect(isIdentity(createScaleTransform(1))).toBe(true);
    });

    it('does not treat a translated unit scale as identity', () => {
      expect(isIdentity(createScaleTransform(1, 10, 0))).toBe(false);
    });

    it('leaves points untouched at 100 percent with no origin offset', () => {
      const point = { clientX: 640, clientY: 360 };
      expect(toScaledSpace(point, IDENTITY_TRANSFORM)).toEqual(point);
      expect(toViewportSpace(point, IDENTITY_TRANSFORM)).toEqual(point);
    });
  });

  describe('scaling without an origin offset', () => {
    it('divides by the scale when converting a viewport point into scaled space at 75 percent', () => {
      const transform = createScaleTransform(0.75);
      expect(toScaledSpace({ clientX: 300, clientY: 150 }, transform)).toEqual({
        clientX: 400,
        clientY: 200,
      });
    });

    it('divides by the scale at 50 percent', () => {
      const transform = createScaleTransform(0.5);
      expect(toScaledSpace({ clientX: 300, clientY: 150 }, transform)).toEqual({
        clientX: 600,
        clientY: 300,
      });
    });

    it('multiplies by the scale when converting back into viewport space', () => {
      const transform = createScaleTransform(0.5);
      expect(toViewportSpace({ clientX: 600, clientY: 300 }, transform)).toEqual({
        clientX: 300,
        clientY: 150,
      });
    });
  });

  describe('scaling about a non zero origin', () => {
    /**
     * Order of operations is the whole point here. Subtracting the origin before dividing, rather
     * than after, produces an error that is exactly zero at 100 percent scale and grows with
     * distance from the origin. That is the kind of mistake a casual test at one scale misses.
     */
    it('subtracts the origin before dividing', () => {
      const transform = createScaleTransform(0.5, 100, 40);
      expect(toScaledSpace({ clientX: 300, clientY: 140 }, transform)).toEqual({
        clientX: 400,
        clientY: 200,
      });
    });

    it('multiplies before adding the origin on the way back', () => {
      const transform = createScaleTransform(0.5, 100, 40);
      expect(toViewportSpace({ clientX: 400, clientY: 200 }, transform)).toEqual({
        clientX: 300,
        clientY: 140,
      });
    });

    it('leaves the origin itself fixed under the transform', () => {
      const transform = createScaleTransform(0.6, 250, 75);
      expect(toScaledSpace({ clientX: 250, clientY: 75 }, transform)).toEqual({
        clientX: 0,
        clientY: 0,
      });
    });
  });

  describe('round tripping', () => {
    const scales = [0.5, 0.75, 1];
    const origins = [
      { x: 0, y: 0 },
      { x: 120, y: 64 },
    ];
    const points = [
      { clientX: 0, clientY: 0 },
      { clientX: 37, clientY: 913 },
      { clientX: 1080, clientY: 1920 },
    ];

    for (const scale of scales) {
      for (const origin of origins) {
        for (const point of points) {
          it(`survives a round trip at scale ${String(scale)} origin ${String(origin.x)},${String(origin.y)} for ${String(point.clientX)},${String(point.clientY)}`, () => {
            const transform = createScaleTransform(scale, origin.x, origin.y);
            const roundTripped = toViewportSpace(toScaledSpace(point, transform), transform);

            expect(roundTripped.clientX).toBeCloseTo(point.clientX, 10);
            expect(roundTripped.clientY).toBeCloseTo(point.clientY, 10);
          });
        }
      }
    }
  });

  describe('validation', () => {
    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects %s as a scale rather than producing silent NaN coordinates',
      (scale) => {
        expect(() => createScaleTransform(scale)).toThrow(RangeError);
      }
    );
  });
});
