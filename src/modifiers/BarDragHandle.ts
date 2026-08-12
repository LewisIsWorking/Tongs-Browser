import type { BarPosition } from './BarPosition.js';

/**
 * Dragging the bar around by its handle. Extracted from ModifierBar 2026-08-12.
 *
 * The bar has to be movable because there is nowhere on a phone screen that is out of the way of
 * everything: whatever the default, some scene, sheet or dialog will sit under it.
 */
export interface BarDragHandleOptions {
  /** Where the bar is now, read at the moment the drag starts. */
  readonly getPosition: () => BarPosition;
  /** Where the bar should go. Clamping is the caller's business, not the handle's. */
  readonly setPosition: (position: BarPosition) => void;
}

export class BarDragHandle {
  /**
   * ⚠️ The drag is keyed to ONE pointer id, and every handler checks it.
   *
   * A second finger landing anywhere while the bar is being dragged would otherwise deliver its moves
   * here too, and the bar would jump between the two fingers. On a phone that is not a rare case: it
   * is what happens when somebody steadies the device with their other hand.
   */
  private pointerId: number | null = null;

  /**
   * Where inside the handle the finger grabbed.
   *
   * ⚠️ Without this the bar's corner jumps to the finger on the first move, which reads as the bar
   * being snatched rather than dragged. Recorded once at the press and held for the whole gesture.
   */
  private offset: BarPosition = { x: 0, y: 0 };

  public constructor(private readonly options: BarDragHandleOptions) {}

  public readonly onPointerDown = (event: PointerEvent): void => {
    const position = this.options.getPosition();
    this.pointerId = event.pointerId;
    this.offset = { x: event.clientX - position.x, y: event.clientY - position.y };

    /*
     * Capture, so the drag survives the finger leaving the small handle. Without it, moving faster
     * than the bar follows drops the drag immediately.
     *
     * ⚠️ Feature detected rather than trusted from the type. `lib.dom` declares pointer capture as
     * always present on Element, but jsdom does not implement it, so calling it blind throws in every
     * test that presses this handle.
     */
    const handle = event.currentTarget as Element;
    if (typeof handle.setPointerCapture === 'function') {
      handle.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  };

  public readonly onPointerMove = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId) {
      return;
    }
    this.options.setPosition({
      x: event.clientX - this.offset.x,
      y: event.clientY - this.offset.y,
    });
    event.preventDefault();
  };

  /** Also the cancel handler, because a cancelled drag must let go exactly like a finished one. */
  public readonly onPointerUp = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId) {
      return;
    }
    const handle = event.currentTarget as Element;
    if (typeof handle.releasePointerCapture === 'function') {
      handle.releasePointerCapture(event.pointerId);
    }
    this.pointerId = null;
  };

  /** Whether a drag is in progress. */
  public isDragging(): boolean {
    return this.pointerId !== null;
  }
}
