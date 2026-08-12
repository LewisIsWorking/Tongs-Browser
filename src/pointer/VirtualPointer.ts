import type { CursorOverlay } from './CursorOverlay.js';
import { DragCapture } from './DragCapture.js';
import { EventDispatcher, type DispatchTargets } from './EventDispatcher.js';
import type { EventDescriptor, PointerPosition } from './EventDescriptor.js';
import type { HitTester } from './HitTester.js';
import type { ModifierFlags } from './ModifierFlags.js';
import {
  createPointerState,
  translated,
  withModifiers,
  withPosition,
  type PointerState,
} from './PointerState.js';
import { MouseButton, type MouseButtonValue } from './buttons.js';
import {
  buildDoubleClickSequence,
  buildLeftClickSequence,
  buildRightClickSequence,
} from './sequences/clickSequence.js';
import {
  buildDragCancelSequence,
  buildDragEndSequence,
  buildDragMoveSequence,
  buildDragStartSequence,
} from './sequences/dragSequence.js';
import { buildMoveSequence } from './sequences/moveSequence.js';
import { buildWheelSequence } from './sequences/wheelSequence.js';

export interface VirtualPointerOptions {
  readonly hitTester: HitTester;
  readonly dispatcher: EventDispatcher;
  readonly cursor?: CursorOverlay;
  readonly initialPosition?: PointerPosition;
}

/**
 * The virtual mouse pointer.
 *
 * Owns the pointer's position, its held buttons, and the element it was last over. Everything about
 * which events to send is delegated to the pure sequence builders, and everything about actually
 * sending them is delegated to the dispatcher. This class is the seam between them, and it holds
 * the one piece of state neither of them can: what was under the pointer last time.
 *
 * The gesture layer drives this. It knows nothing about touches.
 */
export class VirtualPointer {
  private state: PointerState;
  private previousTarget: Element | null = null;
  private dragging = false;
  private dragButton: MouseButtonValue = MouseButton.LEFT;
  /** The element captured at drag start. See resolveDragTarget for why a drag must not re-hit-test. */
  private readonly dragCapture = new DragCapture();

  private readonly hitTester: HitTester;
  private readonly dispatcher: EventDispatcher;
  private readonly cursor: CursorOverlay | undefined;

  public constructor(options: VirtualPointerOptions) {
    this.hitTester = options.hitTester;
    this.dispatcher = options.dispatcher;
    this.cursor = options.cursor;
    this.state = createPointerState(options.initialPosition ?? { clientX: 0, clientY: 0 });
    this.cursor?.moveTo(this.state.position);
  }

  public getState(): PointerState {
    return this.state;
  }

  public getPosition(): PointerPosition {
    return this.state.position;
  }

  public isDragging(): boolean {
    return this.dragging;
  }

  /** Exposed for the debug overlay. Do not dispatch at this directly. */
  public getCurrentTarget(): Element | null {
    return this.previousTarget;
  }

  public setModifiers(modifiers: ModifierFlags): void {
    this.state = withModifiers(this.state, modifiers);
  }

  /** Absolute move. This is the offset mode primitive. */
  public moveTo(position: PointerPosition): void {
    this.applyMove(withPosition(this.state, position));
  }

  /** Relative move. This is the trackpad mode primitive. */
  public moveBy(deltaX: number, deltaY: number): void {
    this.applyMove(translated(this.state, deltaX, deltaY));
  }

  public leftClick(): void {
    this.dispatchAtCurrent(buildLeftClickSequence(this.state));
  }

  public rightClick(): void {
    this.dispatchAtCurrent(buildRightClickSequence(this.state));
  }

  public doubleClick(): void {
    this.dispatchAtCurrent(buildDoubleClickSequence(this.state));
  }

  public wheel(deltaY: number, deltaX = 0): void {
    this.dispatchAtCurrent(buildWheelSequence(this.state, deltaY, deltaX));
  }

  public beginDrag(button: MouseButtonValue = MouseButton.LEFT): void {
    if (this.dragging) {
      return;
    }
    this.dragging = true;
    this.dragButton = button;
    this.cursor?.setButtonHeld(true);
    this.dispatchAtCurrent(buildDragStartSequence(this.state, button));
    // dispatchAtCurrent resolved and recorded the element the press landed on. That element owns the
    // rest of this gesture, exactly as a browser's implicit pointer capture would.
    this.dragCapture.claim(this.previousTarget);
  }

  /** The element every event of an in progress drag goes to. See pointer/DragCapture.ts. */
  private resolveDragTarget(): Element | null {
    return this.dragCapture.resolve(() => this.hitTester.resolve(this.state.position).element);
  }

  /**
   * One step of an in progress drag.
   *
   * ⚠️ Routed through `applyMove` rather than duplicating it, which is what the comment there argues
   * for: the two used to be separate copies of the same operation, and the copy in `moveTo`/`moveBy`
   * was the one that forgot to keep the buttons bitmask set. Routing on the drag STATE rather than on
   * which method was called is exactly what stops them drifting apart again.
   *
   * The guard stays, because a drag step with no drag in progress is a caller error rather than an
   * ordinary hover, and silently turning it into one would hide that.
   */
  public dragBy(deltaX: number, deltaY: number): void {
    if (!this.dragging) {
      return;
    }
    this.applyMove(translated(this.state, deltaX, deltaY));
  }

  public endDrag(): void {
    // The release has to reach the element that received the press, or Foundry is left believing a
    // button is still held and the token stays stuck to the pointer.
    this.finishDrag(buildDragEndSequence(this.state, this.dragButton));
  }

  /**
   * Abandons an in progress drag, for a touch cancelled by the system such as an incoming call.
   * Without this, Foundry keeps its drag state and a token stays stuck to the pointer.
   */
  public cancelDrag(): void {
    this.finishDrag(buildDragCancelSequence(this.state));
  }

  /**
   * Ending and cancelling differ in exactly one thing: the sequence sent. Everything else has to be
   * identical, and keeping them as two copies is how they drift.
   *
   * ⚠️ The target is resolved BEFORE the flag is cleared. Resolving after would take the fallback
   * path on a detached capture and hit test at the pointer, which by then is wherever the drag ended
   * rather than on whatever received the press.
   */
  private finishDrag(sequence: readonly EventDescriptor[]): void {
    if (!this.dragging) {
      return;
    }
    const target = this.resolveDragTarget();
    this.dragging = false;
    this.cursor?.setButtonHeld(false);
    this.dispatcher.dispatchAll(sequence, { current: target, previous: null });
    this.dragCapture.release();
  }

  private applyMove(nextState: PointerState): void {
    const result = this.hitTester.resolve(nextState.position);

    // Clamping may have adjusted the position, so the state records where the pointer actually is
    // rather than where it was asked to go. Otherwise repeated off screen moves would accumulate an
    // ever growing invisible offset that the user would have to swipe back through.
    this.state = withPosition(nextState, result.position);
    this.cursor?.moveTo(this.state.position);

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
    if (this.dragging) {
      // Same capture as dragBy: the element that received the press owns the whole gesture.
      this.dispatcher.dispatchAll(buildDragMoveSequence(this.state, this.dragButton), {
        current: this.resolveDragTarget(),
        previous: null,
      });
      this.previousTarget = result.element;
      return;
    }

    const targets: DispatchTargets = { current: result.element, previous: this.previousTarget };
    const targetChanged = result.element !== this.previousTarget;

    const sequence = buildMoveSequence(this.state, {
      targetChanged,
      hasPreviousTarget: this.previousTarget !== null,
      hasCurrentTarget: result.element !== null,
    });

    this.dispatcher.dispatchAll(sequence, targets);
    this.previousTarget = result.element;
  }

  /**
   * Resolves the target fresh, then dispatches. Never reuses a previously resolved element for the
   * same reason dragBy does not.
   */
  private dispatchAtCurrent(sequence: readonly EventDescriptor[]): void {
    const result = this.hitTester.resolve(this.state.position);
    this.state = withPosition(this.state, result.position);
    this.previousTarget = result.element;
    this.dispatcher.dispatchAll(sequence, { current: result.element, previous: null });
  }
}
