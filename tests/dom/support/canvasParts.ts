import { buildModuleParts, type ModuleParts } from '../../../src/ModuleParts.js';
import { makeTouchEvent } from './touchEvents.js';

/**
 * A module wired to a stub canvas, for the suites that drive two finger gestures. Extracted
 * 2026-08-31 when the zoom suite needed what the pan suite already had.
 */

export interface PanCall {
  x?: number;
  y?: number;
  scale?: number;
}

/**
 * The canvas surface the readers actually touch, and nothing more.
 *
 * ⚠️ Deliberately minimal. A fuller fake would start describing Foundry, and a partial description of
 * somebody else's API that claims to be complete is worse than an obvious stub. `ready`,
 * `stage.scale.x`, `stage.pivot` and `pan` is the whole of what `CanvasReaders` and `CanvasController`
 * read.
 */
export function stubCanvas(scale: number, pivot: { x: number; y: number }): PanCall[] {
  const calls: PanCall[] = [];
  Object.assign(globalThis, {
    canvas: {
      ready: true,
      stage: { scale: { x: scale }, pivot: { ...pivot } },
      pan: (args: PanCall) => {
        calls.push(args);
      },
    },
  });
  return calls;
}

/** The zoom bounds Foundry publishes, which `readZoomLimits` reads and the controller clamps to. */
export function stubZoomLimits(minimum: number, maximum: number): void {
  Object.assign(globalThis, { CONFIG: { Canvas: { minZoom: minimum, maxZoom: maximum } } });
}

export function buildParts(): ModuleParts {
  return buildModuleParts(
    { document, window, suppressNativeTouch: () => true },
    { isEnabled: () => true }
  );
}

/** Two fingers down, then both moved by the same delta: a pan, since the separation is unchanged. */
export function twoFingerDrag(deltaX: number, deltaY: number): void {
  document.dispatchEvent(
    makeTouchEvent('touchstart', [
      { identifier: 1, clientX: 100, clientY: 100 },
      { identifier: 2, clientX: 200, clientY: 100 },
    ])
  );
  document.dispatchEvent(
    makeTouchEvent('touchmove', [
      { identifier: 1, clientX: 100 + deltaX, clientY: 100 + deltaY },
      { identifier: 2, clientX: 200 + deltaX, clientY: 100 + deltaY },
    ])
  );
}

/**
 * Two fingers whose SEPARATION changes, which is what turns a two finger gesture into a pinch.
 *
 * ⚠️ The separation must change by more than `pinchThresholdPx` (12 by default) or the gesture stays
 * a pan and the canvas is panned rather than zoomed. `spread` is applied to BOTH fingers in opposite
 * directions, so the separation changes by twice it.
 */
export function pinch(spread: number): void {
  document.dispatchEvent(
    makeTouchEvent('touchstart', [
      { identifier: 1, clientX: 100, clientY: 100 },
      { identifier: 2, clientX: 200, clientY: 100 },
    ])
  );
  document.dispatchEvent(
    makeTouchEvent('touchmove', [
      { identifier: 1, clientX: 100 - spread, clientY: 100 },
      { identifier: 2, clientX: 200 + spread, clientY: 100 },
    ])
  );
}
