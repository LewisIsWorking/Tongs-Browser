/**
 * Which element owns an in progress drag. Extracted from VirtualPointer 2026-08-12.
 *
 * This is the browser's implicit pointer capture, reimplemented, because a synthesised pointer does
 * not get it for free.
 */
export class DragCapture {
  private captured: Element | null = null;

  /**
   * Claim the element the press landed on.
   *
   * ⚠️ Called with the element resolved AT THE PRESS, not later. That element owns the rest of the
   * gesture, exactly as a browser's implicit pointer capture would.
   */
  public claim(element: Element | null): void {
    this.captured = element;
  }

  /**
   * The element every event of this drag goes to.
   *
   * ⚠️ VirtualPointer used to hit test afresh on every step, and that was the bug behind "dragging a
   * token does nothing" on a real phone. A browser does NOT do that: `pointerdown` implicitly
   * CAPTURES the pointer to the element that received it, and every later move and the up go to that
   * same element however far the pointer travels. Re-resolving means the moment the pointer crosses
   * anything else, a chat window, the modifier bar, a sheet, the drag events are delivered to THAT
   * instead and the canvas simply stops hearing about the drag.
   *
   * Measured on a device: `pointermove buttons=1 -> div#`, when it needed to reach `canvas#board`.
   * It never showed up on desktop, because a drag across empty canvas never crosses anything.
   *
   * ⚠️ The original reason for re-resolving was real and is preserved. Foundry re-renders
   * applications mid interaction, so a captured element can be DETACHED, and dispatching at a
   * detached element throws the event away silently: no error, no warning, and a drag that simply
   * stops. So the capture is honoured only while it is still in the document, and the fallback takes
   * over the moment it is not.
   */
  public resolve(fallback: () => Element | null): Element | null {
    if (this.captured?.isConnected === true) {
      return this.captured;
    }
    const replacement = fallback();
    this.captured = replacement;
    return replacement;
  }

  /** Let go, so the next drag starts from a clean capture rather than inheriting this one. */
  public release(): void {
    this.captured = null;
  }
}
