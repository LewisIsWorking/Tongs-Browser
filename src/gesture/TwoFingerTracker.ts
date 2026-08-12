import type { TouchPoint } from './GestureTypes.js';
import { centroid, separation } from './TouchGeometry.js';

/**
 * Two fingers: pan, or zoom, but never both at once. Extracted from GestureStateMachine 2026-08-12.
 *
 * ⚠️ Kept apart deliberately. Applying both from one gesture makes the canvas lurch, because a small
 * pinch always drags the centroid slightly too, so a user trying to zoom gets a shove sideways they
 * did not ask for. Once the separation changes past the threshold the gesture COMMITS to zooming and
 * does not go back, which is why `update` is told whether it is already committed rather than
 * deciding afresh each time.
 */

export type TwoFingerOutcome =
  | {
      readonly kind: 'zoom';
      readonly ratio: number;
      readonly centerX: number;
      readonly centerY: number;
    }
  | { readonly kind: 'pan'; readonly deltaX: number; readonly deltaY: number }
  /** Fewer than two fingers reported: nothing can be measured, so nothing happens. */
  | { readonly kind: 'nothing' };

export class TwoFingerTracker {
  private lastSeparation = 0;
  private lastCentroid: { clientX: number; clientY: number } = { clientX: 0, clientY: 0 };

  /** Anchor the gesture to where the fingers are now. */
  public begin(touches: readonly TouchPoint[]): void {
    this.lastSeparation = separation(touches);
    this.lastCentroid = centroid(touches);
  }

  public update(
    touches: readonly TouchPoint[],
    pinchThresholdPx: number,
    alreadyZooming: boolean
  ): TwoFingerOutcome {
    if (touches.length < 2) {
      return { kind: 'nothing' };
    }

    const currentSeparation = separation(touches);
    const currentCentroid = centroid(touches);
    const crossedThreshold = Math.abs(currentSeparation - this.lastSeparation) > pinchThresholdPx;

    if (alreadyZooming || crossedThreshold) {
      /*
       * ⚠️ A ratio of 1 when there is nothing to divide by, never a division producing Infinity.
       * Zero separation means the two touches arrived at the same coordinate, which happens on the
       * very first move of a fast pinch, and Infinity would zoom the canvas to nothing in one frame.
       */
      const ratio = this.lastSeparation === 0 ? 1 : currentSeparation / this.lastSeparation;
      this.lastSeparation = currentSeparation;
      this.lastCentroid = currentCentroid;
      return {
        kind: 'zoom',
        ratio,
        centerX: currentCentroid.clientX,
        centerY: currentCentroid.clientY,
      };
    }

    const deltaX = currentCentroid.clientX - this.lastCentroid.clientX;
    const deltaY = currentCentroid.clientY - this.lastCentroid.clientY;
    /*
     * ⚠️ BOTH are updated on a pan, not just the centroid. Leaving the separation stale would measure
     * the next pinch against wherever the fingers were when the gesture started, so a slow spread
     * during a long pan would eventually cross the threshold all at once and jump the zoom.
     */
    this.lastCentroid = currentCentroid;
    this.lastSeparation = currentSeparation;

    return { kind: 'pan', deltaX, deltaY };
  }
}
