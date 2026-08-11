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

    /*
     * ⚠️ CAPTURE phase, not bubble. Changed 2026-08-11, and it is the whole bug.
     *
     * These handlers called `preventDefault()` and stopped there. That prevents scrolling and the
     * browser's compatibility mouse events, and it does NOT stop the touch event propagating.
     * **PIXI listens for `touchstart`, `touchmove` and `touchend` itself** and normalises them into
     * its own pointer events, so the real finger was driving PIXI in parallel with our virtual
     * pointer the entire time.
     *
     * Foundry therefore saw two interactions at once: ours, holding a button on the token, and the
     * finger's, starting wherever the finger actually was, which is never on the token because the
     * whole point of this module is that the pointer goes where the finger is not. The finger's
     * stream destroyed the token's `interactionData`, so the drag gate had nothing to measure from
     * and the state never left GRABBED.
     *
     * Measured on a OnePlus 13, Chrome 150, Foundry 14.365. Driving the SAME device through the
     * module's own pointer with no finger involved, the drag works perfectly and `screenOrigin`
     * stays pinned for 12 samples out of 12. A finger doing the same gesture got 2 samples out of
     * 235, and the token never moved.
     *
     * Capture on the document means we see these before any descendant, and stopping propagation
     * there keeps them from reaching the canvas at all. Excluded regions still return early, so chat
     * and the bar keep their own scrolling and their own touch handling.
     */
    // passive false on every one of these. A passive listener cannot preventDefault, and the
    // browser silently ignores the attempt rather than reporting it.
    const captureOptions: AddEventListenerOptions = { passive: false, capture: true, signal };

    target.addEventListener('touchstart', this.onTouchStart, captureOptions);
    target.addEventListener('touchmove', this.onTouchMove, captureOptions);
    target.addEventListener('touchend', this.onTouchEnd, captureOptions);
    target.addEventListener('touchcancel', this.onTouchCancel, captureOptions);

    /*
     * Capture phase, so a real touch derived pointer event is stopped before it reaches Foundry or
     * PIXI rather than after. Anything arriving with our reserved pointer id is ours and passes
     * through untouched.
     */
    target.addEventListener('pointerdown', this.onNativePointer, { capture: true, signal });
    target.addEventListener('pointermove', this.onNativePointer, { capture: true, signal });
    target.addEventListener('pointerup', this.onNativePointer, { capture: true, signal });
    /*
     * ⚠️ pointercancel, and it is not symmetry for its own sake. Added 2026-08-11.
     *
     * A touchscreen fires `pointercancel` whenever the browser takes a gesture over: a scroll, an
     * edge swipe, a second finger, a system gesture. A mouse never fires it at all, which is exactly
     * why desktop has never once seen this and why it took a device to find.
     *
     * Foundry's MouseInteractionManager treats a cancel as an ABORT. It resets the interaction and
     * discards `interactionData`, including the `screenOrigin` its 10px drag gate is measured from.
     * One stray cancel from the real finger, mid grab, therefore ends the drag silently: the state
     * sits at GRABBED forever, no preview is created, and the token does not move however far you
     * drag.
     *
     * Measured on a OnePlus 13, Chrome 150, Foundry 14.365: 55 drag moves dispatched with Foundry's
     * drag origin readable for only 2 of them, against desktop keeping its origin for every step of
     * the same gesture. Two samples is the interaction being destroyed almost at once.
     *
     * The other three are suppressed because they would DRIVE Foundry twice. This one is suppressed
     * because it would UNDO what we are driving, which is the worse failure of the two: a doubled
     * action is visible, and this produces nothing at all.
     */
    target.addEventListener('pointercancel', this.onNativePointer, { capture: true, signal });
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
