import type { Logger } from '../core/Logger.js';
import type { VirtualPointer } from '../pointer/VirtualPointer.js';
import type { CanvasController } from './CanvasController.js';
import { GestureStateMachine } from './GestureStateMachine.js';
import type { GestureAction, GestureConfig, GestureInput } from './GestureTypes.js';

export interface GestureControllerOptions {
  readonly pointer: VirtualPointer;
  readonly canvas: CanvasController;
  readonly machine?: GestureStateMachine;
  readonly config?: Partial<GestureConfig>;
  readonly logger?: Logger;
  /** Injected so tests do not depend on real timers, and so the timer source can be swapped. */
  readonly setTimer?: (callback: () => void, durationMs: number) => number;
  readonly clearTimer?: (handle: number) => void;
  readonly now?: () => number;
  /** Injected so tests do not need a navigator, and so absence is handled rather than assumed. */
  readonly vibrate?: (durationMs: number) => void;
}

/**
 * Drives the gesture state machine and carries out the actions it returns.
 *
 * The machine decides what should happen and this class makes it happen. Keeping the two apart is
 * what allows every gesture transition to be tested by feeding inputs and comparing plain objects,
 * with no pointer, no canvas and no timers involved.
 */
export class GestureController {
  private readonly machine: GestureStateMachine;
  private timerHandle: number | null = null;

  private readonly setTimer: (callback: () => void, durationMs: number) => number;
  private readonly clearTimer: (handle: number) => void;
  private readonly now: () => number;
  private readonly vibrate: ((durationMs: number) => void) | undefined;

  public constructor(private readonly options: GestureControllerOptions) {
    this.machine = options.machine ?? new GestureStateMachine(options.config ?? {});
    this.setTimer =
      options.setTimer ??
      ((callback, durationMs): number => globalThis.setTimeout(callback, durationMs) as never);
    this.clearTimer =
      options.clearTimer ??
      ((handle): void => {
        globalThis.clearTimeout(handle);
      });
    this.now = options.now ?? ((): number => Date.now());
    this.vibrate = options.vibrate;
  }

  public getMachine(): GestureStateMachine {
    return this.machine;
  }

  public updateConfig(config: Partial<GestureConfig>): void {
    this.machine.updateConfig(config);
  }

  /** Entry point. TouchBinder calls this for every real touch event. */
  public handleInput(input: GestureInput): void {
    const result = this.machine.handle(input);
    for (const action of result.actions) {
      this.perform(action);
    }
  }

  /** Abandons anything in progress, for when the module is switched off mid gesture. */
  public reset(): void {
    this.cancelPendingTimer();
    if (this.options.pointer.isDragging()) {
      this.options.pointer.cancelDrag();
    }
    this.machine.reset();
  }

  private perform(action: GestureAction): void {
    const { pointer, canvas, logger } = this.options;

    switch (action.type) {
      case 'movePointerBy':
        pointer.moveBy(action.deltaX, action.deltaY);
        return;

      case 'movePointerTo':
        pointer.moveTo(action.position);
        return;

      case 'leftClick':
        pointer.leftClick();
        return;

      case 'rightClick':
        pointer.rightClick();
        return;

      case 'doubleClick':
        pointer.doubleClick();
        return;

      case 'beginDrag':
        pointer.beginDrag();
        return;

      case 'dragBy':
        pointer.dragBy(action.deltaX, action.deltaY);
        return;

      case 'endDrag':
        pointer.endDrag();
        return;

      case 'cancelDrag':
        pointer.cancelDrag();
        return;

      case 'panCanvasBy': {
        const panned = canvas.panBy(action.deltaX, action.deltaY);
        if (!panned) {
          logger?.debug('Canvas unavailable, pan ignored.');
        }
        return;
      }

      case 'zoomCanvas': {
        const zoomed = canvas.zoomBy(action.ratio);
        if (!zoomed) {
          logger?.debug('Zoom clamped or canvas unavailable.');
        }
        return;
      }

      case 'startTimer':
        this.startTimer(action.durationMs);
        return;

      case 'cancelTimer':
        this.cancelPendingTimer();
        return;

      case 'haptic':
        // Guarded rather than assumed: navigator.vibrate is absent on iOS entirely, and on Android
        // it is ignored unless the page has been interacted with.
        this.vibrate?.(action.durationMs);
        return;
    }
  }

  private startTimer(durationMs: number): void {
    this.cancelPendingTimer();
    this.timerHandle = this.setTimer(() => {
      this.timerHandle = null;
      this.handleInput({ type: 'timer', at: this.now() });
    }, durationMs);
  }

  private cancelPendingTimer(): void {
    if (this.timerHandle !== null) {
      this.clearTimer(this.timerHandle);
      this.timerHandle = null;
    }
  }
}
