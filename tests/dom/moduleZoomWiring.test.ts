import { beforeEach, describe, expect, it } from 'vitest';

import { buildParts, pinch, stubCanvas, stubZoomLimits } from './support/canvasParts.js';
import { stubFoundryEnvironment } from './support/moduleUnderTest.js';

/**
 * A pinch reaching Foundry's canvas, and the clamp that keeps the result usable. Written 2026-08-31.
 *
 * ⚠️ `getZoomLimits` is the last of the four `ModuleParts` canvas thunks with no caller. The pan
 * suite reaches the other three; only a pinch reaches this one, because only `zoomBy` asks for the
 * limits.
 *
 * The clamp it feeds matters more than it looks. `CanvasController` records why: "An unclamped pinch
 * can drive the scale to a value Foundry refuses, and the canvas then stops responding to zoom
 * entirely until the scene is reloaded." That is a stuck session recovered only by reloading, caused
 * by a gesture a user makes by accident.
 *
 * COVERS: the zoom-limit thunk, and the clamp reading its values rather than a hardcoded pair.
 * MISSES: whether Foundry itself refuses the out-of-range scale. That is its behaviour, not ours.
 */
beforeEach(() => {
  stubFoundryEnvironment();
});

describe('a pinch reaching the canvas', () => {
  it('zooms rather than panning when the separation changes', () => {
    const calls = stubCanvas(1, { x: 1000, y: 800 });
    stubZoomLimits(0.1, 10);
    buildParts().binder.bind();

    pinch(40);

    expect(calls.some((call) => call.scale !== undefined)).toBe(true);
  });

  /**
   * ⚠️ THE CLAMP, read from Foundry's own config rather than assumed. A ceiling of 1.2 must hold
   * however hard the pinch is: the alternative is a scale Foundry refuses and a canvas that ignores
   * zoom until the scene is reloaded.
   */
  it('never exceeds the maximum Foundry publishes', () => {
    const calls = stubCanvas(1, { x: 1000, y: 800 });
    stubZoomLimits(0.5, 1.2);
    buildParts().binder.bind();

    pinch(300);

    const scales = calls.map((call) => call.scale).filter((scale) => scale !== undefined);
    expect(scales.length).toBeGreaterThan(0);
    for (const scale of scales) {
      expect(scale).toBeLessThanOrEqual(1.2);
    }
  });

  /**
   * ⚠️ The floor as well as the ceiling, and read from the same place. A pinch inwards on a scene
   * already fitted to a phone is the easy way to reach it.
   */
  it('never falls below the minimum Foundry publishes', () => {
    const calls = stubCanvas(1, { x: 1000, y: 800 });
    stubZoomLimits(0.8, 10);
    buildParts().binder.bind();

    pinch(-300);

    const scales = calls.map((call) => call.scale).filter((scale) => scale !== undefined);
    for (const scale of scales) {
      expect(scale).toBeGreaterThanOrEqual(0.8);
    }
  });

  /**
   * ⚠️ Reads the limits rather than carrying its own. Two runs with different published maxima must
   * land on different ceilings; a hardcoded pair would satisfy either one alone.
   */
  it('follows the published limits rather than a constant of its own', () => {
    const tight = stubCanvas(1, { x: 1000, y: 800 });
    stubZoomLimits(0.5, 1.2);
    buildParts().binder.bind();
    pinch(300);
    const tightPeak = Math.max(...tight.map((call) => call.scale ?? 0));

    const loose = stubCanvas(1, { x: 1000, y: 800 });
    stubZoomLimits(0.5, 3);
    buildParts().binder.bind();
    pinch(300);
    const loosePeak = Math.max(...loose.map((call) => call.scale ?? 0));

    expect(tightPeak).toBeLessThanOrEqual(1.2);
    expect(loosePeak).toBeGreaterThan(1.2);
  });
});
