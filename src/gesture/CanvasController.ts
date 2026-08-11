import type { Logger } from '../core/Logger.js';

export interface CanvasLike {
  ready: boolean;
  pan(options: { x?: number; y?: number; scale?: number }): void;
}

export interface CanvasControllerOptions {
  /** Returns Foundry's canvas, or null when it is unavailable or not yet ready. */
  readonly getCanvas: () => CanvasLike | null;
  /**
   * The scale the canvas is ACTUALLY at, or null when it cannot be read.
   *
   * Required rather than optional, deliberately, added 2026-08-09. This controller used to keep its
   * own `currentScale`, seeded to 1, with a `syncScale` method to correct it that nothing ever
   * called. Foundry fits a scene to the viewport on load, so the real scale is almost never 1, and
   * the first pinch of a session therefore multiplied the ratio onto the wrong base and applied it
   * absolutely.
   *
   * Measured against a real Foundry: a scene sitting at 0.5 with a 1.6x pinch jumped to 1.6 instead
   * of 0.8, a 3.2x lurch. The error is exactly 1/initialScale, so it is worst on the scenes that are
   * zoomed furthest out.
   *
   * An optional callback would have let a call site forget it and silently reintroduce the same bug,
   * which is precisely how the first version survived. Making it required means every caller has to
   * answer the question.
   */
  readonly getScale: () => number | null;
  /**
   * Where the viewport is centred right now, in SCENE coordinates, or null when it cannot be read.
   *
   * Required for the same reason getScale is. Foundry's `canvas.pan({x, y})` is ABSOLUTE: it sets
   * the centre of the view, it does not shift it. This controller was handing it a raw screen delta,
   * so a 50px drag did not pan by 50px, it teleported the view to scene coordinate -50.
   *
   * Measured 2026-08-11 on a live 14.365: a two finger drag of +120,+120 moved the pivot to
   * (-1940, -980) on a 4000x3000 scene. The guard covering this asserted only that the pivot moved
   * NEGATIVELY, which the bug satisfies perfectly, so it stayed green throughout.
   */
  readonly getPivot: () => { x: number; y: number } | null;
  /** Returns the configured zoom bounds, if the running Foundry exposes them. */
  readonly getZoomLimits?: () => { minimum: number; maximum: number };
  readonly logger?: Logger;
  /** Called when the canvas is unavailable and the caller should fall back to a synthesised drag. */
  readonly onUnavailable?: () => void;
}

/** Used when Foundry does not expose zoom bounds. Wide enough not to fight the system's own limits. */
const FALLBACK_MIN_ZOOM = 0.1;
const FALLBACK_MAX_ZOOM = 10;

/**
 * Pans and zooms Foundry's canvas.
 *
 * Calling canvas.pan directly is preferred over faking a right button drag, because a synthesised
 * drag has to fight Foundry's own drag handlers: the canvas interprets a right drag as a selection
 * or a pan depending on tool state, and the two interpretations disagree. Calling pan states the
 * intent exactly and cannot be misread.
 *
 * The synthesised drag remains as a fallback for the case where the canvas is genuinely
 * unavailable, for instance in a world with no scene loaded.
 */
export class CanvasController {
  /**
   * Only a fallback, for when the live scale cannot be read at all. It is never the preferred
   * source, because a cached scale is exactly what went wrong before: anything that zooms the canvas
   * without going through this controller, which includes Foundry's own zoom controls, the mouse
   * wheel and a scene change, leaves it stale.
   */
  private lastAppliedScale = 1;

  public constructor(private readonly options: CanvasControllerOptions) {}

  public isAvailable(): boolean {
    return this.options.getCanvas()?.ready ?? false;
  }

  /**
   * Pans by a screen space delta.
   *
   * Two conversions, and leaving either out breaks it in a way that still looks plausible.
   *
   * ⚠️ `canvas.pan({x, y})` is ABSOLUTE. It sets where the viewport is centred, in scene
   * coordinates, so a delta cannot be passed to it. This used to do exactly that, and a 50px drag
   * teleported the view to scene coordinate -50 rather than panning by 50. Measured on a live
   * 14.365: a +120,+120 drag put the pivot at (-1940, -980).
   *
   * The delta is also in SCREEN pixels while the pivot is in SCENE units, so it has to be divided by
   * the current scale. Skipping that makes panning correct at 1x and wrong everywhere else, which is
   * the hardest kind of wrong to notice: on a scene fitted to a phone at 0.5 every pan goes twice as
   * far as the finger.
   *
   * The sign is inverted on purpose: dragging two fingers to the right should move the map WITH the
   * fingers, which means moving the viewport centre to the left. That is what makes it feel like
   * dragging paper rather than dragging a scrollbar.
   */
  public panBy(deltaX: number, deltaY: number): boolean {
    const canvas = this.options.getCanvas();
    if (!canvas?.ready) {
      this.options.onUnavailable?.();
      return false;
    }

    const pivot = this.options.getPivot();
    if (pivot === null || !Number.isFinite(pivot.x) || !Number.isFinite(pivot.y)) {
      return false;
    }

    const live = this.options.getScale();
    const scale = live !== null && Number.isFinite(live) && live > 0 ? live : this.lastAppliedScale;

    canvas.pan({ x: pivot.x - deltaX / scale, y: pivot.y - deltaY / scale });
    return true;
  }

  /**
   * Applies a relative zoom ratio, clamped to the configured bounds.
   *
   * Clamping matters more than it looks. An unclamped pinch can drive the scale to a value Foundry
   * refuses, and the canvas then stops responding to zoom entirely until the scene is reloaded.
   */
  public zoomBy(ratio: number): boolean {
    const canvas = this.options.getCanvas();
    if (!canvas?.ready) {
      this.options.onUnavailable?.();
      return false;
    }
    if (!Number.isFinite(ratio) || ratio <= 0) {
      return false;
    }

    const limits = this.options.getZoomLimits?.() ?? {
      minimum: FALLBACK_MIN_ZOOM,
      maximum: FALLBACK_MAX_ZOOM,
    };

    // The live scale wins whenever it can be read. The cached one is a last resort, not a cache.
    const live = this.options.getScale();
    const base = live !== null && Number.isFinite(live) && live > 0 ? live : this.lastAppliedScale;

    const requested = base * ratio;
    const clamped = Math.min(Math.max(requested, limits.minimum), limits.maximum);

    if (clamped === base) {
      return false;
    }

    this.lastAppliedScale = clamped;
    canvas.pan({ scale: clamped });
    return true;
  }

  /** The last scale this controller applied. The canvas is the authority, not this. */
  public getLastAppliedScale(): number {
    return this.lastAppliedScale;
  }
}
