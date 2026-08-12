/**
 * Reading Foundry's canvas, defensively. Extracted from TongsBrowser 2026-08-12.
 *
 * ⚠️ Every one of these reads FRESH rather than caching, and that is the point of gathering them.
 * Foundry fits a scene to the viewport on load, the user can zoom with the wheel or Foundry's own
 * controls, and a scene change replaces the stage outright. Any remembered value is wrong the moment
 * anything else touches it, and a stale scale silently multiplies into every pinch that follows.
 *
 * They return null rather than a default, because the caller can fall back sensibly and this cannot:
 * a zoom built on a guessed scale produces a canvas at the wrong magnification with nothing to say
 * why, where a null lets the controller decline the gesture and leave the view alone.
 */

/** The canvas surface, described only as far as these readers touch it. */
export interface CanvasStage {
  readonly stage?: {
    readonly scale?: { readonly x?: number };
    readonly pivot?: { readonly x: number; readonly y: number };
  };
}

export interface ScenePoint {
  readonly x: number;
  readonly y: number;
}

/** How far the canvas is actually zoomed, straight from PIXI's root container. */
export function readCanvasScale(canvas: CanvasStage | undefined): number | null {
  if (canvas === undefined) {
    return null;
  }
  return canvas.stage?.scale?.x ?? null;
}

/** The scene point the viewport is centred on. */
export function readCanvasPivot(canvas: CanvasStage | undefined): ScenePoint | null {
  if (canvas === undefined) {
    return null;
  }
  const pivot = canvas.stage?.pivot;
  if (pivot === undefined) {
    return null;
  }
  /*
   * Copied rather than handed back. PIXI mutates its pivot in place on every pan, so returning the
   * live object would give the caller a value that changes underneath it: a "before" reading taken
   * for comparison would silently become the "after" one.
   */
  return { x: pivot.x, y: pivot.y };
}

/** How far Foundry allows the canvas to be zoomed. */
export interface ZoomLimits {
  readonly minimum: number;
  readonly maximum: number;
}

/**
 * ⚠️ Written defensively because these have MOVED between Foundry versions, and a missing value here
 * does not fail loudly: it produces `undefined` and then NaN scales, which render as a blank canvas
 * with no error anywhere.
 */
export function readZoomLimits(
  config: { readonly minZoom?: number; readonly maxZoom?: number } | undefined
): ZoomLimits {
  return {
    minimum: config?.minZoom ?? 0.1,
    maximum: config?.maxZoom ?? 10,
  };
}
