/**
 * Which events have to be kept away from PIXI, and why each one is on the list. Extracted from
 * NativePointerSuppressor 2026-08-13, when that file reached 211 lines against a hard 200 limit.
 *
 * This is an INVENTORY of somebody else's listeners, which is a different kind of knowledge from the
 * mechanism that acts on it. It goes stale when Foundry or PIXI changes; the suppressor does not.
 *
 * PIXI's own registration, read out of `@pixi/events/lib/EventSystem.mjs` in Foundry 14.365:
 *
 *     globalThis.document.addEventListener('pointermove', this.onPointerMove, true)
 *     this.domElement.addEventListener('pointerdown', this.onPointerDown, true)
 *     this.domElement.addEventListener('pointerover', this.onPointerOverOut, true)
 *     this.domElement.addEventListener('pointerleave', this.onPointerOverOut, true)
 *     globalThis.addEventListener('pointerup', this.onPointerUp, true)
 *
 * Three things follow, and missing any one of them makes the suppression useless:
 *
 * 1. **`pointerup` is on the WINDOW.** In the capture phase the window fires BEFORE the document, so
 *    a document listener cannot stop it however early it is registered. The suppressor binds to the
 *    window.
 * 2. **Two listeners on the SAME node fire in registration order**, and `stopPropagation` does not
 *    stop them. Being on the window is not enough on its own: the suppressor must also be registered
 *    before PIXI, and it must use `stopImmediatePropagation`.
 * 3. **`pointerover` and `pointerout` were never suppressed at all.** Foundry's
 *    `MouseInteractionManager` binds both, and the device report that forced this opens with
 *    `manager.cancel at GRABBED [pointerover ... touch]`.
 *
 * Why it matters: `#handlePointerUp` ends with `this.#handleDragCancel(event)`. ANY pointerup that
 * reaches the manager cancels the drag, and `_onDragLeftCancel` writes nothing, so the token returns
 * to where it started while every other measurement looks healthy.
 */

/**
 * Every pointer event PIXI listens for, so none of them reaches it from a real finger.
 *
 * ⚠️ `pointerout` is included although PIXI itself binds `pointerleave`: Foundry's manager binds
 * `pointerout` on its own objects, and PIXI delivers a federated `pointerout` derived from the same
 * native stream. Suppressing one and not the other leaves half the door open.
 */
export const SUPPRESSED_POINTER_EVENTS = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'pointerover',
  'pointerout',
  'pointerenter',
  'pointerleave',
] as const;

/**
 * Mouse events the browser SYNTHESISES from a touch, suppressed only over the module's own bar.
 *
 * ⚠️ Only over our own interface, never globally. On a desktop these are a real mouse and Foundry
 * needs every one of them; blanket suppression would make the module unusable with a mouse. Over our
 * bar they carry no information at all, because the buttons work from `click`, which is deliberately
 * not in this list.
 *
 * Measured 2026-08-12: one finger tap on the grab button emitted a trusted `mousedown` and `mouseup`
 * at the button's coordinates, roughly 300ms after touchend, and both reached the window capture
 * phase where PIXI listens. PIXI maps by coordinate rather than by DOM target, and the bar sits over
 * the canvas.
 */
export const OWN_UI_SUPPRESSED_MOUSE_EVENTS = ['mousedown', 'mouseup', 'mousemove'] as const;
