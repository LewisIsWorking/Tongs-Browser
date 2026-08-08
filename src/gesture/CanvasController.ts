import type { Logger } from '../core/Logger.js';

export interface CanvasLike {
  ready: boolean;
  pan(options: { x?: number; y?: number; scale?: number }): void;
}

export interface CanvasControllerOptions {
  /** Returns Foundry's canvas, or null when it is unavailable or not yet ready. */
  readonly getCanvas: () => CanvasLike | null;
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
  private currentScale = 1;

  public constructor(private readonly options: CanvasControllerOptions) {}

  public isAvailable(): boolean {
    return this.options.getCanvas()?.ready ?? false;
  }

  /**
   * Pans by a screen space delta.
   *
   * The sign is inverted: dragging two fingers to the right should move the map with the fingers,
   * which means moving the viewport centre to the left. Matching the physical metaphor is what
   * makes panning feel like dragging paper rather than dragging a scrollbar.
   */
  public panBy(deltaX: number, deltaY: number): boolean {
    const canvas = this.options.getCanvas();
    if (!canvas?.ready) {
      this.options.onUnavailable?.();
      return false;
    }

    canvas.pan({ x: -deltaX, y: -deltaY });
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

    const requested = this.currentScale * ratio;
    const clamped = Math.min(Math.max(requested, limits.minimum), limits.maximum);

    if (clamped === this.currentScale) {
      return false;
    }

    this.currentScale = clamped;
    canvas.pan({ scale: clamped });
    return true;
  }

  /** Keeps the controller's idea of the scale in step with the canvas, after an external zoom. */
  public syncScale(scale: number): void {
    if (Number.isFinite(scale) && scale > 0) {
      this.currentScale = scale;
    }
  }

  public getScale(): number {
    return this.currentScale;
  }
}
