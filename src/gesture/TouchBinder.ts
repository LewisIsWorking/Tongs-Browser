import { VIRTUAL_POINTER_ID } from '../constants.js';
import type { ExclusionZones } from './ExclusionZones.js';
import type { GestureInput, TouchPoint } from './GestureTypes.js';
import {
  TOUCH_LISTENER_SPECS,
  toListenerOptions,
  type TouchHandlerName,
} from './TouchListenerSpecs.js';

export interface TouchBinderOptions {
  readonly target: Document;
  readonly exclusions: ExclusionZones;
  readonly onInput: (input: GestureInput) => void;
  /** Reject real touch derived pointer events so Foundry never sees both them and ours. */
  readonly suppressNativeTouch: () => boolean;
  readonly now: () => number;
}

function toTouchPoints(touchList: TouchList): TouchPoint[] {
  const points: TouchPoint[] = [];
  for (let index = 0; index < touchList.length; index += 1) {
    const touch = touchList.item(index);
    if (touch !== null) {
      points.push({ id: touch.identifier, clientX: touch.clientX, clientY: touch.clientY });
    }
  }
  return points;
}

/**
 * Bridges real touch events into the gesture state machine.
 *
 * Listeners are registered with passive false so preventDefault actually works. Without it the
 * browser scrolls the page, fires its own synthetic mouse events roughly 300ms later, and shows
 * text selection handles, all on top of whatever this module is doing.
 *
 * The suppression half is separately toggleable because it is the single most likely thing to
 * conflict with another module. TouchVTT in particular binds the same events, and a user may
 * reasonably want both installed with only one of them acting.
 */
export class TouchBinder {
  private bound = false;
  private readonly abortController = new AbortController();

  public constructor(private readonly options: TouchBinderOptions) {}

  public bind(): void {
    if (this.bound) {
      return;
    }
    this.bound = true;

    const { signal } = this.abortController;
    const handlers: Record<TouchHandlerName, EventListener> = {
      onTouchStart: this.onTouchStart,
      onTouchMove: this.onTouchMove,
      onTouchEnd: this.onTouchEnd,
      onTouchCancel: this.onTouchCancel,
      onNativePointer: this.onNativePointer,
      onNativeContextMenu: this.onNativeContextMenu,
    };

    /*
     * The table lives in TouchListenerSpecs, where the terms can be ASSERTED. Every entry there
     * encodes a bug that took a physical device to find, and each is one option flag away from
     * silently not working: a bubble phase listener still fires and a passive one still runs, and
     * both look completely normal in a debugger while what they exist to prevent goes right past.
     */
    for (const spec of TOUCH_LISTENER_SPECS) {
      this.options.target.addEventListener(
        spec.type,
        handlers[spec.handler],
        toListenerOptions(spec, signal)
      );
    }
  }

  public unbind(): void {
    if (!this.bound) {
      return;
    }
    this.abortController.abort();
    this.bound = false;
  }

  public isBound(): boolean {
    return this.bound;
  }

  private readonly onNativePointer = (event: Event): void => {
    if (!this.options.suppressNativeTouch()) {
      return;
    }
    const pointerEvent = event as PointerEvent;
    if (pointerEvent.pointerType !== 'touch' || pointerEvent.pointerId === VIRTUAL_POINTER_ID) {
      return;
    }
    if (this.options.exclusions.isExcluded(event.target)) {
      return;
    }
    event.stopPropagation();
  };

  /**
   * Swallow the browser's own contextmenu, which Foundry treats as "cancel the drag".
   *
   * Only the TRUSTED one. This module synthesises a `contextmenu` for its long press gesture, and
   * that one is deliberate and must reach Foundry; the browser's, produced by a finger dwelling
   * during a drag, must not. `isTrusted` is exactly that distinction and needs no bookkeeping.
   *
   * `preventDefault` as well as `stopPropagation`, so the platform's own menu does not appear either.
   * An excluded region keeps its normal behaviour, so a long press in chat still offers copy.
   */
  private readonly onNativeContextMenu = (event: Event): void => {
    if (!this.options.suppressNativeTouch() || !event.isTrusted) {
      return;
    }
    if (this.options.exclusions.isExcluded(event.target)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly onTouchStart = (event: Event): void => {
    const touchEvent = event as TouchEvent;
    if (this.options.exclusions.isExcluded(touchEvent.target)) {
      return;
    }
    event.preventDefault();
    // Keep the raw touch away from PIXI, which would otherwise turn it into a second pointer.
    // See bind() for why preventDefault alone was not enough.
    if (this.options.suppressNativeTouch()) {
      event.stopPropagation();
    }
    this.options.onInput({
      type: 'touchstart',
      touches: toTouchPoints(touchEvent.touches),
      at: this.options.now(),
    });
  };

  private readonly onTouchMove = (event: Event): void => {
    const touchEvent = event as TouchEvent;
    if (this.options.exclusions.isExcluded(touchEvent.target)) {
      return;
    }
    event.preventDefault();
    // Keep the raw touch away from PIXI, which would otherwise turn it into a second pointer.
    // See bind() for why preventDefault alone was not enough.
    if (this.options.suppressNativeTouch()) {
      event.stopPropagation();
    }
    this.options.onInput({
      type: 'touchmove',
      touches: toTouchPoints(touchEvent.touches),
      at: this.options.now(),
    });
  };

  private readonly onTouchEnd = (event: Event): void => {
    const touchEvent = event as TouchEvent;
    if (this.options.exclusions.isExcluded(touchEvent.target)) {
      return;
    }
    event.preventDefault();
    // Keep the raw touch away from PIXI, which would otherwise turn it into a second pointer.
    // See bind() for why preventDefault alone was not enough.
    if (this.options.suppressNativeTouch()) {
      event.stopPropagation();
    }
    this.options.onInput({
      type: 'touchend',
      touches: toTouchPoints(touchEvent.touches),
      at: this.options.now(),
    });
  };

  private readonly onTouchCancel = (event: Event): void => {
    const touchEvent = event as TouchEvent;
    if (this.options.exclusions.isExcluded(touchEvent.target)) {
      return;
    }
    if (this.options.suppressNativeTouch()) {
      event.stopPropagation();
    }
    this.options.onInput({ type: 'touchcancel', at: this.options.now() });
  };
}
