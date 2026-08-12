import type { GestureConfig, TouchPoint } from './GestureTypes.js';
import { distance } from './TouchGeometry.js';

/**
 * Whether a new touch belongs to the tap before it. Extracted from GestureStateMachine 2026-08-12.
 *
 * ⚠️ This does NOT decide between a double tap and a tap then hold drag, and that is the subtle part.
 * Both begin identically: a tap, a lift, and a second touch soon after and close by. Only the
 * DURATION of that second touch tells them apart, so the same state covers both and the timer
 * decides. All this answers is the narrower question of whether the two touches are related at all.
 */
export interface TapRecord {
  readonly at: number;
  readonly x: number;
  readonly y: number;
}

export type TapWindowConfig = Pick<GestureConfig, 'doubleTapWindowMs' | 'doubleTapSlopPx'>;

/**
 * Both a time and a distance, and both are needed.
 *
 * Time alone would join a tap here to a tap across the screen a moment later, which is two separate
 * intentions. Distance alone would join a tap to one in the same place a minute later, which is
 * somebody returning to a control they already used.
 */
export function continuesPreviousTap(
  touch: TouchPoint,
  at: number,
  lastTap: TapRecord | null,
  config: TapWindowConfig
): boolean {
  if (lastTap === null) {
    return false;
  }
  return (
    at - lastTap.at <= config.doubleTapWindowMs &&
    distance(touch, { clientX: lastTap.x, clientY: lastTap.y }) <= config.doubleTapSlopPx
  );
}
