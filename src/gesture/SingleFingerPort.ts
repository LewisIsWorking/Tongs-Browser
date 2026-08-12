import type {
  GestureAction,
  GestureConfig,
  GestureResult,
  GestureStateValue,
  TouchPoint,
} from './GestureTypes.js';

/**
 * What the finger states are allowed to reach. Its own file 2026-08-12, so both halves of the split
 * can name it without importing each other.
 */
export interface SingleFingerPort {
  readonly getConfig: () => GestureConfig;
  /** Record the transition and produce the result, so the machine stays the one owner of `state`. */
  readonly result: (state: GestureStateValue, actions?: GestureAction[]) => GestureResult;
  readonly beginTwoFinger: (touches: readonly TouchPoint[]) => void;
}
