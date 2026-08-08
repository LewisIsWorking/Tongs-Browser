import type { CursorOverlay } from './CursorOverlay.js';
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
  }

  /**
   * One step of an in progress drag.
   *
   * The target is resolved fresh on every step rather than captured at drag start, because Foundry
   * re-renders applications mid interaction and an element captured earlier can be detached by now.
   * Dispatching at a detached element throws the event away without any error.
   */
  public dragBy(deltaX: number, deltaY: number): void {
    if (!this.dragging) {
      return;
    }
    this.state = translated(this.state, deltaX, deltaY);
    this.cursor?.moveTo(this.state.position);

    const result = this.hitTester.resolve(this.state.position);
    this.state = withPosition(this.state, result.position);
    this.previousTarget = result.element;

    this.dispatcher.dispatchAll(buildDragMoveSequence(this.state, this.dragButton), {
      current: result.element,
      previous: null,
    });
  }

  public endDrag(): void {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    this.cursor?.setButtonHeld(false);
    this.dispatchAtCurrent(buildDragEndSequence(this.state, this.dragButton));
  }

  /**
   * Abandons an in progress drag, for a touch cancelled by the system such as an incoming call.
   * Without this, Foundry keeps its drag state and a token stays stuck to the pointer.
   */
  public cancelDrag(): void {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    this.cursor?.setButtonHeld(false);
    this.dispatchAtCurrent(buildDragCancelSequence(this.state));
  }

  private applyMove(nextState: PointerState): void {
    const result = this.hitTester.resolve(nextState.position);

    // Clamping may have adjusted the position, so the state records where the pointer actually is
    // rather than where it was asked to go. Otherwise repeated off screen moves would accumulate an
    // ever growing invisible offset that the user would have to swipe back through.
    this.state = withPosition(nextState, result.position);
    this.cursor?.moveTo(this.state.position);

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
