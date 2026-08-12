import { describe, expect, it } from 'vitest';

import {
  readCanvasPivot,
  readCanvasScale,
  readZoomLimits,
} from '../../src/foundry/CanvasReaders.js';

/**
 * Reading Foundry's canvas, defensively.
 *
 * Every one of these returns null rather than a default, because the caller can fall back sensibly
 * and these cannot: a zoom built on a guessed scale produces a canvas at the wrong magnification
 * with nothing to say why, where a null lets the controller decline and leave the view alone.
 */
describe('readCanvasScale', () => {
  it('reads the zoom straight from the root container', () => {
    expect(readCanvasScale({ stage: { scale: { x: 0.75 } } })).toBe(0.75);
  });

  it('reads a scale of zero as a real value rather than as absent', () => {
    expect(readCanvasScale({ stage: { scale: { x: 0 } } })).toBe(0);
  });

  it.each([
    ['no canvas at all', undefined],
    ['a canvas with no stage', {}],
    ['a stage with no scale', { stage: {} }],
    ['a scale with no x', { stage: { scale: {} } }],
  ])('gives null for %s', (_case, canvas) => {
    expect(readCanvasScale(canvas)).toBeNull();
  });
});

describe('readCanvasPivot', () => {
  it('reads where the viewport is centred', () => {
    expect(readCanvasPivot({ stage: { pivot: { x: 100, y: 200 } } })).toEqual({ x: 100, y: 200 });
  });

  /**
   * ⚠️ COPIED, not handed back. PIXI mutates its pivot in place on every pan, so returning the live
   * object gives the caller a value that changes underneath it: a "before" reading taken for
   * comparison silently becomes the "after" one, and every delta measures zero.
   */
  it('copies the pivot, so a later pan cannot rewrite a reading already taken', () => {
    const pivot = { x: 100, y: 200 };
    const before = readCanvasPivot({ stage: { pivot } });

    pivot.x = 999;
    pivot.y = 999;

    expect(before).toEqual({ x: 100, y: 200 });
  });

  it.each([
    ['no canvas at all', undefined],
    ['a canvas with no stage', {}],
    ['a stage with no pivot', { stage: {} }],
  ])('gives null for %s', (_case, canvas) => {
    expect(readCanvasPivot(canvas)).toBeNull();
  });
});

describe('readZoomLimits', () => {
  it("uses Foundry's own bounds when it exposes them", () => {
    expect(readZoomLimits({ minZoom: 0.25, maxZoom: 3 })).toEqual({ minimum: 0.25, maximum: 3 });
  });

  /**
   * ⚠️ These have MOVED between Foundry versions, and a missing value does not fail loudly: it
   * produces undefined and then NaN scales, which render as a blank canvas with no error anywhere.
   */
  it('falls back rather than producing NaN when the bounds have moved', () => {
    expect(readZoomLimits(undefined)).toEqual({ minimum: 0.1, maximum: 10 });
    expect(readZoomLimits({})).toEqual({ minimum: 0.1, maximum: 10 });
  });

  it('falls back per bound, not all or nothing', () => {
    expect(readZoomLimits({ minZoom: 0.5 })).toEqual({ minimum: 0.5, maximum: 10 });
    expect(readZoomLimits({ maxZoom: 4 })).toEqual({ minimum: 0.1, maximum: 4 });
  });
});
