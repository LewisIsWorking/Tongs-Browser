import {
  DEFAULT_GESTURE_CONFIG,
  GestureState,
  type GestureAction,
  type GestureConfig,
  type GestureInput,
  type GestureResult,
  type GestureStateValue,
  type TouchPoint,
} from './GestureTypes.js';
import { distance } from './TouchGeometry.js';
import { TwoFingerTracker } from './TwoFingerTracker.js';

interface TapRecord {
  readonly at: number;
  readonly x: number;
  readonly y: number;
}

/**
 * The gesture finite state machine.
 *
 * Explicit named states rather than a pile of booleans, because the interesting bugs in touch
 * handling are all "which mode am I in" bugs. With a flag soup, a tap that arrives during a drag
 * produces a combination nobody thought about. With a state, that transition either exists or it
 * does not, and the tests enumerate them.
 *
 * The machine is pure. It never reads a clock, never sets a timer, never touches the DOM. Time
 * arrives as a timestamp on every input, and timers are requested as actions and reported back as
 * a 'timer' input. That is what makes every transition testable by feeding a list of inputs and
 * comparing plain objects.
 */
export class GestureStateMachine {
  private state: GestureStateValue = GestureState.IDLE;
  private config: GestureConfig;

  private startPosition: TouchPoint | null = null;
  private lastPosition: TouchPoint | null = null;
  private startedAt = 0;
  /** True when this touch began inside the double tap window of the previous one. */
  private secondTapPending = false;
  private lastTap: TapRecord | null = null;
  private readonly twoFinger = new TwoFingerTracker();

  public constructor(config: Partial<GestureConfig> = {}) {
    this.config = { ...DEFAULT_GESTURE_CONFIG, ...config };
  }

  public getState(): GestureStateValue {
    return this.state;
  }

  public getConfig(): GestureConfig {
    return this.config;
  }

  public updateConfig(config: Partial<GestureConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Returns to IDLE and forgets everything, for when the module is disabled mid gesture. */
  public reset(): void {
    this.state = GestureState.IDLE;
    this.startPosition = null;
    this.lastPosition = null;
    this.secondTapPending = false;
    this.lastTap = null;
  }

  public handle(input: GestureInput): GestureResult {
    switch (this.state) {
      case GestureState.IDLE:
        return this.fromIdle(input);
      case GestureState.LONG_PRESS_PENDING:
        return this.fromLongPressPending(input);
      case GestureState.TRACKING:
        return this.fromTracking(input);
      case GestureState.DRAGGING:
        return this.fromDragging(input);
      case GestureState.TWO_FINGER:
        return this.fromTwoFingerState(input, GestureState.TWO_FINGER);
      case GestureState.PINCHING:
        return this.fromTwoFingerState(input, GestureState.PINCHING);
    }
  }

  private result(state: GestureStateValue, actions: GestureAction[] = []): GestureResult {
    this.state = state;
    return { state, actions };
  }

  private beginTwoFinger(touches: readonly TouchPoint[]): void {
    this.twoFinger.begin(touches);
  }

  private fromIdle(input: GestureInput): GestureResult {
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
    this.lastPosition = touch;
    this.startedAt = input.at;

    /*
     * A touch landing soon after a tap, and near it, is related to that tap. Whether it is the
     * second half of a double tap or the start of a tap then hold drag is not yet knowable: both
     * begin identically, and only the duration of this second touch tells them apart. So the same
     * state covers both and the timer decides.
     */
    this.secondTapPending =
      this.lastTap !== null &&
      input.at - this.lastTap.at <= this.config.doubleTapWindowMs &&
      distance(touch, { clientX: this.lastTap.x, clientY: this.lastTap.y }) <=
        this.config.doubleTapSlopPx;

    const timerDuration = this.secondTapPending ? this.config.tapMaxMs : this.config.longPressMs;

    return this.result(GestureState.LONG_PRESS_PENDING, [
      { type: 'startTimer', durationMs: timerDuration },
    ]);
  }

  private fromLongPressPending(input: GestureInput): GestureResult {
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
          this.lastPosition = touch;
          return this.result(GestureState.LONG_PRESS_PENDING);
        }

        const actions: GestureAction[] = [{ type: 'cancelTimer' }, ...this.moveActions(touch)];
        this.lastPosition = touch;
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

  private fromTracking(input: GestureInput): GestureResult {
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
        const actions = this.moveActions(touch);
        this.lastPosition = touch;
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

  private fromDragging(input: GestureInput): GestureResult {
    switch (input.type) {
      case 'touchmove': {
        const touch = input.touches[0];
        if (touch === undefined || this.lastPosition === null) {
          return this.result(GestureState.DRAGGING);
        }
        const deltaX = (touch.clientX - this.lastPosition.clientX) * this.config.sensitivity;
        const deltaY = (touch.clientY - this.lastPosition.clientY) * this.config.sensitivity;
        this.lastPosition = touch;
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

  /**
   * Pan or zoom, with the arithmetic and the pan-versus-zoom rule in TwoFingerTracker.
   *
   * Both states share this because they differ in exactly one way: PINCHING has already committed to
   * zooming and must not fall back to panning, which is the `alreadyZooming` argument.
   */
  private fromTwoFingerState(
    input: GestureInput,
    state: typeof GestureState.TWO_FINGER | typeof GestureState.PINCHING
  ): GestureResult {
    switch (input.type) {
      case 'touchmove': {
        const outcome = this.twoFinger.update(
          input.touches,
          this.config.pinchThresholdPx,
          state === GestureState.PINCHING
        );

        if (outcome.kind === 'zoom') {
          return this.result(GestureState.PINCHING, [
            {
              type: 'zoomCanvas',
              ratio: outcome.ratio,
              centerX: outcome.centerX,
              centerY: outcome.centerY,
            },
          ]);
        }
        if (outcome.kind === 'pan') {
          return this.result(GestureState.TWO_FINGER, [
            { type: 'panCanvasBy', deltaX: outcome.deltaX, deltaY: outcome.deltaY },
          ]);
        }
        return this.result(state);
      }

      case 'touchend':
      case 'touchcancel':
        /*
         * Ends the gesture even if one finger is still down. Handing the surviving finger straight to
         * the pointer would make it jump from wherever the pan left it, which reads as a glitch.
         * Requiring a clean lift is predictable.
         */
        return this.result(GestureState.IDLE);

      case 'touchstart':
      case 'timer':
        return this.result(state);
    }
  }

  /**
   * Turns finger movement into pointer movement, according to the configured mode.
   *
   * Trackpad mode applies a relative delta, so the pointer stays where it was left and sensitivity
   * multiplies reach. Offset mode places the pointer a fixed distance above the finger, so the
   * finger never covers the target. The first suits a phone, the second a tablet.
   */
  private moveActions(touch: TouchPoint): GestureAction[] {
    if (this.config.pointerMode === 'offset') {
      return [
        {
          type: 'movePointerTo',
          position: {
            clientX: touch.clientX,
            clientY: touch.clientY - this.config.offsetDistancePx,
          },
        },
      ];
    }

    if (this.lastPosition === null) {
      return [];
    }

    return [
      {
        type: 'movePointerBy',
        deltaX: (touch.clientX - this.lastPosition.clientX) * this.config.sensitivity,
        deltaY: (touch.clientY - this.lastPosition.clientY) * this.config.sensitivity,
      },
    ];
  }
}
