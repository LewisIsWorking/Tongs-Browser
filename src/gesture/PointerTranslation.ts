import type { GestureAction, GestureConfig, TouchPoint } from './GestureTypes.js';

/**
 * How finger movement becomes pointer movement. Extracted from GestureStateMachine 2026-08-12.
 *
 * The two modes exist because a phone and a tablet want different things, and neither is a
 * compromise for the other:
 *
 * - **Trackpad** applies a RELATIVE delta, so the pointer stays where it was left and sensitivity
 *   multiplies reach. On a phone that is what lets a thumb cover a screen wider than it can span.
 * - **Offset** places the pointer a fixed distance ABOVE the finger, so the finger never covers the
 *   target. On a tablet, where reach is not the problem, that is the more direct feel.
 */
export type TranslationConfig = Pick<
  GestureConfig,
  'pointerMode' | 'offsetDistancePx' | 'sensitivity'
>;

export function pointerMoveActions(
  touch: TouchPoint,
  lastPosition: TouchPoint | null,
  config: TranslationConfig
): GestureAction[] {
  if (config.pointerMode === 'offset') {
    /*
     * ABSOLUTE, so no previous position is needed. The pointer goes where the finger is, minus the
     * offset, which is why this mode works from the very first move of a gesture while trackpad mode
     * has nothing to measure from yet.
     */
    return [
      {
        type: 'movePointerTo',
        position: {
          clientX: touch.clientX,
          clientY: touch.clientY - config.offsetDistancePx,
        },
      },
    ];
  }

  /*
   * ⚠️ Nothing at all, rather than a delta measured from zero. Without a previous position the only
   * available origin is the origin, so a first move would fling the pointer by the full distance from
   * the top left corner of the screen to the finger.
   */
  if (lastPosition === null) {
    return [];
  }

  return [
    {
      type: 'movePointerBy',
      deltaX: (touch.clientX - lastPosition.clientX) * config.sensitivity,
      deltaY: (touch.clientY - lastPosition.clientY) * config.sensitivity,
    },
  ];
}
