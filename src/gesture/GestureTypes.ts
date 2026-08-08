import type { PointerPosition } from '../pointer/EventDescriptor.js';

/**
 * Vocabulary for the gesture layer.
 *
 * Nothing here references a DOM type. The state machine consumes these abstract inputs and returns
 * abstract actions, so the whole of the gesture logic is testable in plain node. Translating real
 * TouchEvents into these inputs, and these actions into pointer calls, is the driver's job.
 */

export const GestureState = {
  /** Nothing in progress. */
  IDLE: 'IDLE',
  /** One finger down and moving the pointer. No click will follow on release. */
  TRACKING: 'TRACKING',
  /** One finger down, still within the tap slop, waiting to see what it becomes. */
  LONG_PRESS_PENDING: 'LONG_PRESS_PENDING',
  /** A button is held and the pointer is being dragged. */
  DRAGGING: 'DRAGGING',
  /** Two fingers down, panning the canvas. */
  TWO_FINGER: 'TWO_FINGER',
  /** Two fingers down, changing separation, zooming the canvas. */
  PINCHING: 'PINCHING',
} as const;

export type GestureStateValue = (typeof GestureState)[keyof typeof GestureState];

export interface TouchPoint {
  readonly id: number;
  readonly clientX: number;
  readonly clientY: number;
}

export type GestureInput =
  | { readonly type: 'touchstart'; readonly touches: readonly TouchPoint[]; readonly at: number }
  | { readonly type: 'touchmove'; readonly touches: readonly TouchPoint[]; readonly at: number }
  | { readonly type: 'touchend'; readonly touches: readonly TouchPoint[]; readonly at: number }
  | { readonly type: 'touchcancel'; readonly at: number }
  /** The driver reports that the timer it was asked to start has elapsed. */
  | { readonly type: 'timer'; readonly at: number };

/**
 * What the driver should do. The state machine never performs any of these itself, which is what
 * keeps it pure and what makes every transition assertable by comparing plain objects.
 */
export type GestureAction =
  | { readonly type: 'movePointerBy'; readonly deltaX: number; readonly deltaY: number }
  | { readonly type: 'movePointerTo'; readonly position: PointerPosition }
  | { readonly type: 'leftClick' }
  | { readonly type: 'rightClick' }
  | { readonly type: 'doubleClick' }
  | { readonly type: 'beginDrag' }
  | { readonly type: 'dragBy'; readonly deltaX: number; readonly deltaY: number }
  | { readonly type: 'endDrag' }
  | { readonly type: 'cancelDrag' }
  | { readonly type: 'panCanvasBy'; readonly deltaX: number; readonly deltaY: number }
  | {
      readonly type: 'zoomCanvas';
      readonly ratio: number;
      readonly centerX: number;
      readonly centerY: number;
    }
  | { readonly type: 'startTimer'; readonly durationMs: number }
  | { readonly type: 'cancelTimer' }
  | { readonly type: 'haptic'; readonly durationMs: number };

export interface GestureConfig {
  /** How long a stationary finger must be held to count as a long press. */
  readonly longPressMs: number;
  /** Longest a touch can last and still count as a tap. */
  readonly tapMaxMs: number;
  /** How far a finger may move and still count as stationary. */
  readonly tapSlopPx: number;
  /** Window after a tap in which a second touch counts as related to it. */
  readonly doubleTapWindowMs: number;
  /** How near a second tap must land to count as a double tap rather than a fresh one. */
  readonly doubleTapSlopPx: number;
  /** Change in finger separation before a two finger pan becomes a pinch. */
  readonly pinchThresholdPx: number;
  /** Multiplier applied to finger movement in trackpad mode. */
  readonly sensitivity: number;
  readonly pointerMode: 'trackpad' | 'offset';
  /** How far above the finger the pointer sits in offset mode. */
  readonly offsetDistancePx: number;
  readonly haptics: boolean;
}

export const DEFAULT_GESTURE_CONFIG: GestureConfig = Object.freeze({
  longPressMs: 500,
  tapMaxMs: 200,
  tapSlopPx: 10,
  doubleTapWindowMs: 300,
  doubleTapSlopPx: 30,
  pinchThresholdPx: 12,
  sensitivity: 1.5,
  pointerMode: 'trackpad',
  offsetDistancePx: 60,
  haptics: true,
});

export interface GestureResult {
  readonly state: GestureStateValue;
  readonly actions: readonly GestureAction[];
}
