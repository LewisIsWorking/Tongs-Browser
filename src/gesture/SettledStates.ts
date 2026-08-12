import {
  GestureState,
  type GestureInput,
  type GestureResult,
  type TouchPoint,
} from './GestureTypes.js';
import { pointerMoveActions } from './PointerTranslation.js';
import type { SingleFingerPort } from './SingleFingerStates.js';

/**
 * The two states where the gesture's identity is already settled. Extracted from SingleFingerStates
 * 2026-08-12.
 *
 * TRACKING means the finger is moving the pointer and the release must NOT produce a click. DRAGGING
 * means a button is held and every move carries it. Both need only the last position, where the
 * deciding states need five fields, so keeping them apart is what stops a handler here reaching a
 * field that means nothing to it.
 */
export class SettledStates {
  private last: TouchPoint | null = null;

  public constructor(private readonly port: SingleFingerPort) {}

  /** Where the finger was last seen, which every relative move is measured from. */
  public lastPosition(): TouchPoint | null {
    return this.last;
  }

  public rememberPosition(touch: TouchPoint): void {
    this.last = touch;
  }

  public reset(): void {
    this.last = null;
  }

  private get config() {
    return this.port.getConfig();
  }

  private result(
    state: Parameters<SingleFingerPort['result']>[0],
    actions?: Parameters<SingleFingerPort['result']>[1]
  ): GestureResult {
    return this.port.result(state, actions);
  }

  private beginTwoFinger(touches: readonly TouchPoint[]): void {
    this.port.beginTwoFinger(touches);
  }

  public fromTracking(input: GestureInput): GestureResult {
    switch (input.type) {
      case 'touchstart': {
        if (input.touches.length >= 2) {
          this.beginTwoFinger(input.touches);
          return this.result(GestureState.TWO_FINGER);
        }
        return this.result(GestureState.TRACKING);
      }

      case 'touchmove': {
        const touch = input.touches[0];
        if (touch === undefined) {
          return this.result(GestureState.TRACKING);
        }
        const actions = pointerMoveActions(touch, this.last, this.config);
        this.last = touch;
        return this.result(GestureState.TRACKING, actions);
      }

      case 'touchend':
      case 'touchcancel':
        // No click. Either the pointer was being moved, or a long press already consumed this
        // gesture with a right click.
        return this.result(GestureState.IDLE);

      case 'timer':
        return this.result(GestureState.TRACKING);
    }
  }

  public fromDragging(input: GestureInput): GestureResult {
    switch (input.type) {
      case 'touchmove': {
        const touch = input.touches[0];
        if (touch === undefined || this.last === null) {
          return this.result(GestureState.DRAGGING);
        }
        const deltaX = (touch.clientX - this.last.clientX) * this.config.sensitivity;
        const deltaY = (touch.clientY - this.last.clientY) * this.config.sensitivity;
        this.last = touch;
        return this.result(GestureState.DRAGGING, [{ type: 'dragBy', deltaX, deltaY }]);
      }

      case 'touchend':
        return this.result(GestureState.IDLE, [{ type: 'endDrag' }]);

      case 'touchcancel':
        // The system took the touch away, for example an incoming call. Abandon rather than
        // complete, or Foundry is left holding a token that never got dropped.
        return this.result(GestureState.IDLE, [{ type: 'cancelDrag' }]);

      case 'touchstart': {
        if (input.touches.length >= 2) {
          this.beginTwoFinger(input.touches);
          return this.result(GestureState.TWO_FINGER, [{ type: 'endDrag' }]);
        }
        return this.result(GestureState.DRAGGING);
      }

      case 'timer':
        return this.result(GestureState.DRAGGING);
    }
  }
}
