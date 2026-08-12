import type { CursorOverlay } from './CursorOverlay.js';
import { DragController } from './DragController.js';
import { EventDispatcher } from './EventDispatcher.js';
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
import { dispatchHover } from './HoverSequence.js';
import { buildWheelSequence } from './sequences/wheelSequence.js';

export interface VirtualPointerOptions {
  readonly hitTester: HitTester;
  readonly dispatcher: EventDispatcher;
  readonly cursor?: CursorOverlay;
  readonly initialPosition?: PointerPosition;
  /**
   * Called immediately after a drag's opening pointerdown. Required, never optional: see
   * foundry/LongPressGuard.ts for what it defuses and why forgetting it must not be possible.
   */
  readonly onDragBegun: () => void;
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
  /** Holding a button across a gesture, with the captured element. See pointer/DragController.ts. */
  private readonly drag: DragController;

  private readonly hitTester: HitTester;
  private readonly onDragBegun: () => void;
  private readonly dispatcher: EventDispatcher;
  private readonly cursor: CursorOverlay | undefined;

  public constructor(options: VirtualPointerOptions) {
    this.hitTester = options.hitTester;
    this.onDragBegun = options.onDragBegun;
    this.dispatcher = options.dispatcher;
    this.cursor = options.cursor;
    this.state = createPointerState(options.initialPosition ?? { clientX: 0, clientY: 0 });
    this.cursor?.moveTo(this.state.position);

    this.drag = new DragController({
      dispatchAt: (sequence, target) => {
        this.dispatcher.dispatchAll(sequence, { current: target, previous: null });
      },
      dispatchHere: (sequence) => {
        this.dispatchAtCurrent(sequence);
      },
      lastTarget: () => this.previousTarget,
      hitTestHere: () => this.hitTester.resolve(this.state.position).element,
      setButtonHeld: (held) => {
        this.cursor?.setButtonHeld(held);
      },
    });
  }

  public getState(): PointerState {
    return this.state;
  }

  public getPosition(): PointerPosition {
    return this.state.position;
  }

  public isDragging(): boolean {
    return this.drag.isDragging();
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
    this.drag.begin(button, (held) => buildDragStartSequence(this.state, held));
    // ⚠️ AFTER the sequence: the pointerdown is what arms the timer. See foundry/LongPressGuard.ts.
    this.onDragBegun();
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
    if (!this.drag.isDragging()) {
      return;
    }
    this.applyMove(translated(this.state, deltaX, deltaY));
  }

  public endDrag(): void {
    // The release has to reach the element that received the press, or Foundry is left believing a
    // button is still held and the token stays stuck to the pointer.
    this.drag.finish(buildDragEndSequence(this.state, this.drag.heldButton()));
  }

  /**
   * Abandons an in progress drag, for a touch cancelled by the system such as an incoming call.
   * Without this, Foundry keeps its drag state and a token stays stuck to the pointer.
   */
  public cancelDrag(): void {
    this.drag.finish(buildDragCancelSequence(this.state));
  }

  private applyMove(nextState: PointerState): void {
    const result = this.hitTester.resolve(nextState.position);

    // Clamping may have adjusted the position, so the state records where the pointer actually is
    // rather than where it was asked to go. Otherwise repeated off screen moves would accumulate an
    // ever growing invisible offset that the user would have to swipe back through.
    this.state = withPosition(nextState, result.position);
    this.cursor?.moveTo(this.state.position);

    // While a button is held, ANY movement is a drag, however it arrived. See DragController.
    if (this.drag.moveStep(buildDragMoveSequence(this.state, this.drag.heldButton()))) {
      this.previousTarget = result.element;
      return;
    }

    dispatchHover(this.dispatcher, this.state, this.previousTarget, result.element);
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
