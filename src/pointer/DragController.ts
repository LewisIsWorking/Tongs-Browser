import { DragCapture } from './DragCapture.js';
import type { EventDescriptor } from './EventDescriptor.js';
import { MouseButton, type MouseButtonValue } from './buttons.js';

/**
 * Holding a button down across a gesture. Extracted from VirtualPointer 2026-08-12.
 *
 * Kept together because the three parts move as one: whether a button is held, WHICH button, and
 * which element owns the gesture. Splitting them is how a drag ends up half released, with Foundry
 * still believing a button is down and a token stuck to the pointer.
 */
export interface DragPort {
  /** Send a sequence at a specific element, bypassing the ordinary hover targeting. */
  readonly dispatchAt: (sequence: readonly EventDescriptor[], target: Element | null) => void;
  /** Send a sequence at wherever the pointer is now, resolving the element fresh. */
  readonly dispatchHere: (sequence: readonly EventDescriptor[]) => void;
  /** The element the last dispatch landed on, which is what a press captures. */
  readonly lastTarget: () => Element | null;
  /** Hit test at the pointer's current position, for when a captured element has detached. */
  readonly hitTestHere: () => Element | null;
  readonly setButtonHeld: (held: boolean) => void;
}

export class DragController {
  private dragging = false;
  private button: MouseButtonValue = MouseButton.LEFT;
  private readonly capture = new DragCapture();

  public constructor(private readonly port: DragPort) {}

  public isDragging(): boolean {
    return this.dragging;
  }

  public heldButton(): MouseButtonValue {
    return this.button;
  }

  /** The element every event of an in progress drag goes to. See pointer/DragCapture.ts. */
  public resolveTarget(): Element | null {
    return this.capture.resolve(() => this.port.hitTestHere());
  }

  public begin(
    button: MouseButtonValue,
    startSequence: (button: MouseButtonValue) => readonly EventDescriptor[]
  ): void {
    if (this.dragging) {
      return;
    }
    this.dragging = true;
    this.button = button;
    this.port.setButtonHeld(true);
    this.port.dispatchHere(startSequence(button));
    /*
     * Claimed AFTER the press has been dispatched, because the press is what resolves the element.
     * That element owns the rest of this gesture, exactly as a browser's implicit pointer capture
     * would.
     */
    this.capture.claim(this.port.lastTarget());
  }

  /*
   * While a button is held, ANY movement is a drag, however it arrived.
   *
   * The buttons bitmask has to stay set on every move of a drag, or Foundry reads the stream as a
   * hover and nothing follows the pointer. dragBy set it; moveTo and moveBy did not, so a drag
   * begun through beginDrag and then continued by ordinary pointer movement silently degraded into
   * a hover. Measured 2026-08-11 on a device: grab held the button, the token stayed exactly where
   * it was, and the pointer glided over it.
   *
   * That mattered the moment a grab could be started from a button rather than only by the tap
   * then hold gesture, because the natural next thing to do is move the pointer the ordinary way.
   * Routing on the drag STATE rather than on which method was called is what makes the two agree.
   */
  public moveStep(sequence: readonly EventDescriptor[]): boolean {
    if (!this.dragging) {
      return false;
    }
    // The element that received the press owns the whole gesture, exactly as for the release.
    this.port.dispatchAt(sequence, this.resolveTarget());
    return true;
  }

  /**
   * Ending and cancelling differ in exactly one thing: the sequence sent. Everything else has to be
   * identical, and keeping them as two copies is how they drift.
   *
   * ⚠️ The target is resolved BEFORE the flag is cleared. Resolving after would take the fallback
   * path on a detached capture and hit test at the pointer, which by then is wherever the drag ended
   * rather than on whatever received the press.
   */
  public finish(sequence: readonly EventDescriptor[]): void {
    if (!this.dragging) {
      return;
    }
    const target = this.resolveTarget();
    this.dragging = false;
    this.port.setButtonHeld(false);
    this.port.dispatchAt(sequence, target);
    this.capture.release();
  }
}
