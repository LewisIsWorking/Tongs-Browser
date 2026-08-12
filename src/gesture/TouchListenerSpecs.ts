/**
 * Which listeners the touch binder installs, and on what terms. Extracted from TouchBinder
 * 2026-08-12.
 *
 * A table rather than a run of `addEventListener` calls, so the terms can be ASSERTED. Every entry
 * here encodes a bug that took a physical device to find, and each is one option flag away from
 * silently not working: a bubble phase listener still fires, a passive one still runs, and both look
 * completely normal in a debugger while the behaviour they exist to prevent goes right past them.
 */

/** The handlers a binder supplies, named so the table can refer to them without holding them. */
export type TouchHandlerName =
  | 'onTouchStart'
  | 'onTouchMove'
  | 'onTouchEnd'
  | 'onTouchCancel'
  | 'onNativePointer'
  | 'onNativeContextMenu';

export interface TouchListenerSpec {
  readonly type: string;
  readonly handler: TouchHandlerName;
  /**
   * ⚠️ `capture` is true on every single one, and that is the whole fix rather than a preference.
   *
   * These handlers used to call `preventDefault()` and stop there. That prevents scrolling and the
   * browser's compatibility mouse events, and it does NOT stop the touch event propagating. PIXI
   * listens for `touchstart`, `touchmove` and `touchend` ITSELF and normalises them into its own
   * pointer events, so the real finger was driving PIXI in parallel with the virtual pointer the
   * entire time.
   *
   * Foundry therefore saw two interactions at once: ours, holding a button on the token, and the
   * finger's, starting wherever the finger actually was, which is never on the token because the
   * whole point of this module is that the pointer goes where the finger is not. The finger's stream
   * destroyed the token's `interactionData`, so the drag gate had nothing to measure from and the
   * state never left GRABBED.
   *
   * Measured on a OnePlus 13, Chrome 150, Foundry 14.365. Driving the SAME device through the
   * module's own pointer with no finger involved, the drag works and `screenOrigin` stays pinned for
   * 12 samples out of 12. A finger doing the same gesture got 2 samples out of 235, and the token
   * never moved.
   */
  readonly capture: true;
  /**
   * False only where `preventDefault` is actually called.
   *
   * ⚠️ A passive listener CANNOT preventDefault, and the browser silently ignores the attempt rather
   * than reporting it. There is no error, no warning, and no way to tell from the code that the call
   * did nothing.
   */
  readonly passive?: false;
  /** Why this listener exists at all, for whoever reads the table next. */
  readonly because: string;
}

export const TOUCH_LISTENER_SPECS: readonly TouchListenerSpec[] = [
  {
    type: 'touchstart',
    handler: 'onTouchStart',
    capture: true,
    passive: false,
    because:
      'PIXI listens for raw touch itself, so the finger drives Foundry alongside our pointer',
  },
  {
    type: 'touchmove',
    handler: 'onTouchMove',
    capture: true,
    passive: false,
    because:
      'PIXI normalises raw touchmove into its own pointer events, and this is also the one that ' +
      'scrolls the page away under the user if it is not prevented',
  },
  {
    type: 'touchend',
    handler: 'onTouchEnd',
    capture: true,
    passive: false,
    because:
      'an unsuppressed touchend lets PIXI complete an interaction the module never started, which ' +
      'clears the one Foundry is holding for our pointer',
  },
  {
    type: 'touchcancel',
    handler: 'onTouchCancel',
    capture: true,
    passive: false,
    because:
      'the browser cancels a touch whenever it takes the gesture over, and PIXI would pass that ' +
      'straight to Foundry as an abort of whatever we are driving',
  },

  /*
   * ⚠️ The pointer events are NOT here, and their absence is deliberate.
   *
   * They used to be, on the document, and it could never have worked: PIXI binds `pointerup` on the
   * WINDOW in the capture phase, which fires before the document. Suppressing them is now
   * gesture/NativePointerSuppressor.ts, bound on the window at Foundry's init so it is registered
   * before PIXI exists.
   */
  {
    /*
     * ⚠️ contextmenu, which is what has been CANCELLING every drag. Added 2026-08-11.
     *
     * Read out of Foundry's own `client/canvas/interaction/mouse-handler.mjs`, where
     * MouseInteractionManager builds its handler map:
     *
     *     contextmenu: this.#handleDragCancel.bind(this)
     *
     * A `contextmenu` event cancels an in progress drag outright. `_onDragLeftCancel` writes nothing,
     * so the token stays exactly where it was and every other measurement looks healthy: the gate
     * opens, the state reaches DRAG, a preview clone is created, and then the whole thing is thrown
     * away. A device reported precisely that, three cancels and not one drop.
     *
     * On a phone a long press on the canvas produces a native `contextmenu`, and a finger dwelling
     * mid drag is not an edge case, it is how people drag. A mouse only produces one on a deliberate
     * right click, which is why no desktop run has ever seen this and why it survived every
     * measurement that did not come from the hardware.
     *
     * `isTrusted` separates the two cases exactly: the browser's own event is trusted, and the one
     * this module synthesises for a long press gesture is not. So a real long press is swallowed and
     * the module's deliberate right click still reaches Foundry.
     */
    type: 'contextmenu',
    handler: 'onNativeContextMenu',
    capture: true,
    because: 'Foundry maps contextmenu straight to its drag CANCEL, so a long press kills the drag',
  },
];

/** The options object a spec describes, ready for `addEventListener`. */
export function toListenerOptions(
  spec: TouchListenerSpec,
  signal: AbortSignal
): AddEventListenerOptions {
  return spec.passive === undefined
    ? { capture: spec.capture, signal }
    : { capture: spec.capture, passive: spec.passive, signal };
}
