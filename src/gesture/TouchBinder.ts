import { VIRTUAL_POINTER_ID } from '../constants.js';
import type { ExclusionZones } from './ExclusionZones.js';
import type { GestureInput, TouchPoint } from './GestureTypes.js';

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
    const target = this.options.target;

    // passive false on every one of these. A passive listener cannot preventDefault, and the
    // browser silently ignores the attempt rather than reporting it.
    const listenerOptions: AddEventListenerOptions = { passive: false, signal };

    target.addEventListener('touchstart', this.onTouchStart, listenerOptions);
    target.addEventListener('touchmove', this.onTouchMove, listenerOptions);
    target.addEventListener('touchend', this.onTouchEnd, listenerOptions);
    target.addEventListener('touchcancel', this.onTouchCancel, listenerOptions);

    /*
     * Capture phase, so a real touch derived pointer event is stopped before it reaches Foundry or
     * PIXI rather than after. Anything arriving with our reserved pointer id is ours and passes
     * through untouched.
     */
    target.addEventListener('pointerdown', this.onNativePointer, { capture: true, signal });
    target.addEventListener('pointermove', this.onNativePointer, { capture: true, signal });
    target.addEventListener('pointerup', this.onNativePointer, { capture: true, signal });
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

  private readonly onTouchStart = (event: Event): void => {
    const touchEvent = event as TouchEvent;
    if (this.options.exclusions.isExcluded(touchEvent.target)) {
      return;
    }
    event.preventDefault();
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
    this.options.onInput({ type: 'touchcancel', at: this.options.now() });
  };
}
