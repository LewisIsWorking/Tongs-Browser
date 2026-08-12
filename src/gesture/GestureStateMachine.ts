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
import { SingleFingerStates } from './SingleFingerStates.js';
import { TwoFingerTracker } from './TwoFingerTracker.js';

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

  private readonly twoFinger = new TwoFingerTracker();

  /**
   * The four states a single finger can be in. See gesture/SingleFingerStates.ts.
   *
   * Separated because those four share five pieces of state that the two finger states never touch,
   * and a class holding both sets is a class where any handler can reach any field.
   */
  private readonly singleFinger: SingleFingerStates;

  public constructor(config: Partial<GestureConfig> = {}) {
    this.config = { ...DEFAULT_GESTURE_CONFIG, ...config };
    this.singleFinger = new SingleFingerStates({
      getConfig: () => this.config,
      result: (state, actions) => this.result(state, actions),
      beginTwoFinger: (touches) => {
        this.beginTwoFinger(touches);
      },
    });
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
    this.singleFinger.reset();
  }

  public handle(input: GestureInput): GestureResult {
    switch (this.state) {
      case GestureState.IDLE:
        return this.singleFinger.fromIdle(input);
      case GestureState.LONG_PRESS_PENDING:
        return this.singleFinger.fromLongPressPending(input);
      case GestureState.TRACKING:
        return this.singleFinger.fromTracking(input);
      case GestureState.DRAGGING:
        return this.singleFinger.fromDragging(input);
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
}
