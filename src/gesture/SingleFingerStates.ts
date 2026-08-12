import {
  GestureState,
  type GestureAction,
  type GestureConfig,
  type GestureInput,
  type GestureResult,
  type GestureStateValue,
  type TouchPoint,
} from './GestureTypes.js';
import { pointerMoveActions } from './PointerTranslation.js';
import { continuesPreviousTap, type TapRecord } from './TapWindow.js';
import { SettledStates } from './SettledStates.js';
import type { SingleFingerPort } from './SingleFingerPort.js';
import { distance } from './TouchGeometry.js';

export class SingleFingerStates {
  private startPosition: TouchPoint | null = null;
  private startedAt = 0;

  /** True when this touch began inside the double tap window of the previous one. */
  private secondTapPending = false;
  private lastTap: TapRecord | null = null;

  /**
   * The two states where the gesture's identity is already settled. See gesture/SettledStates.ts.
   *
   * They need only the last position, where these need five fields, so keeping them apart is what
   * stops a handler here reaching a field that means nothing to it.
   */
  private readonly settled: SettledStates;

  public constructor(private readonly port: SingleFingerPort) {
    this.settled = new SettledStates(port);
  }

  public fromTracking(input: GestureInput): GestureResult {
    return this.settled.fromTracking(input);
  }

  public fromDragging(input: GestureInput): GestureResult {
    return this.settled.fromDragging(input);
  }

  /** Forget everything, for when the module is disabled mid gesture. */
  public reset(): void {
    /*
     * The settled states are cleared too, for hygiene rather than for a bug.
     *
     * ⚠️ Being straight about the limit, because it looks load bearing and is not: a stale last
     * position is NOT observable, since every fresh gesture starts at a `touchstart` and `fromIdle`
     * writes the position before any move can read it. Removing this line leaves the whole suite
     * green, and that was checked rather than assumed. It stays because state outliving its gesture
     * is a hazard waiting for the first handler that reads it before a touchstart, not because
     * anything today depends on it.
     */
    this.settled.reset();
    this.startPosition = null;
    this.secondTapPending = false;
    this.lastTap = null;
  }

  private get config(): GestureConfig {
    return this.port.getConfig();
  }

  private result(state: GestureStateValue, actions: GestureAction[] = []): GestureResult {
    return this.port.result(state, actions);
  }

  private beginTwoFinger(touches: readonly TouchPoint[]): void {
    this.port.beginTwoFinger(touches);
  }

  public fromIdle(input: GestureInput): GestureResult {
    if (input.type !== 'touchstart') {
      return this.result(GestureState.IDLE);
    }

    if (input.touches.length >= 2) {
      this.beginTwoFinger(input.touches);
      return this.result(GestureState.TWO_FINGER, [{ type: 'cancelTimer' }]);
    }

    const touch = input.touches[0];
    if (touch === undefined) {
      return this.result(GestureState.IDLE);
    }

    this.startPosition = touch;
    this.settled.rememberPosition(touch);
    this.startedAt = input.at;

    /*
     * A touch landing soon after a tap, and near it, is related to that tap. Whether it is the
     * second half of a double tap or the start of a tap then hold drag is not yet knowable: both
     * begin identically, and only the duration of this second touch tells them apart. So the same
     * state covers both and the timer decides.
     */
    this.secondTapPending = continuesPreviousTap(touch, input.at, this.lastTap, this.config);

    const timerDuration = this.secondTapPending ? this.config.tapMaxMs : this.config.longPressMs;

    return this.result(GestureState.LONG_PRESS_PENDING, [
      { type: 'startTimer', durationMs: timerDuration },
    ]);
  }

  public fromLongPressPending(input: GestureInput): GestureResult {
    switch (input.type) {
      case 'touchstart': {
        if (input.touches.length >= 2) {
          this.beginTwoFinger(input.touches);
          return this.result(GestureState.TWO_FINGER, [{ type: 'cancelTimer' }]);
        }
        return this.result(GestureState.LONG_PRESS_PENDING);
      }

      case 'touchmove': {
        const touch = input.touches[0];
        if (touch === undefined || this.startPosition === null) {
          return this.result(GestureState.LONG_PRESS_PENDING);
        }

        if (distance(touch, this.startPosition) <= this.config.tapSlopPx) {
          // Still stationary. Hold the pointer where it is and let the timer keep running.
          this.settled.rememberPosition(touch);
          return this.result(GestureState.LONG_PRESS_PENDING);
        }

        const actions: GestureAction[] = [
          { type: 'cancelTimer' },
          ...pointerMoveActions(touch, this.settled.lastPosition(), this.config),
        ];
        this.settled.rememberPosition(touch);
        return this.result(GestureState.TRACKING, actions);
      }

      case 'timer': {
        if (this.secondTapPending) {
          // Held rather than released, so this is a tap then hold drag rather than a double tap.
          this.secondTapPending = false;
          this.lastTap = null;
          const actions: GestureAction[] = [{ type: 'beginDrag' }];
          if (this.config.haptics) {
            actions.push({ type: 'haptic', durationMs: 15 });
          }
          return this.result(GestureState.DRAGGING, actions);
        }

        const actions: GestureAction[] = [{ type: 'rightClick' }];
        if (this.config.haptics) {
          actions.push({ type: 'haptic', durationMs: 15 });
        }
        /*
         * Straight to TRACKING rather than back to IDLE. The finger is still down, so any further
         * movement should move the pointer, and the release must not also produce a tap click.
         * TRACKING is exactly the state with those two properties.
         */
        this.lastTap = null;
        return this.result(GestureState.TRACKING, actions);
      }

      case 'touchend': {
        const actions: GestureAction[] = [{ type: 'cancelTimer' }];

        if (this.secondTapPending) {
          this.secondTapPending = false;
          this.lastTap = null;
          actions.push({ type: 'doubleClick' });
          return this.result(GestureState.IDLE, actions);
        }

        const withinTapDuration = input.at - this.startedAt <= this.config.tapMaxMs;
        if (withinTapDuration && this.startPosition !== null) {
          /*
           * The click lands at the pointer's current position, not where the finger touched down.
           * That is the trackpad model and it is the whole point: the finger positions the pointer,
           * the pointer decides what gets clicked, and the finger never occludes the target.
           */
          actions.push({ type: 'leftClick' });
          this.lastTap = {
            at: input.at,
            x: this.startPosition.clientX,
            y: this.startPosition.clientY,
          };
        }

        return this.result(GestureState.IDLE, actions);
      }

      case 'touchcancel':
        this.secondTapPending = false;
        return this.result(GestureState.IDLE, [{ type: 'cancelTimer' }]);
    }
  }
}
