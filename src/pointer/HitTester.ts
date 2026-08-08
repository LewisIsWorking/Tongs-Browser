import {
  IDENTITY_TRANSFORM,
  isIdentity,
  toScaledSpace,
  type ScaleTransform,
} from './CoordinateTransform.js';
import type { PointerPosition } from './EventDescriptor.js';

/** Signature of document.elementFromPoint, injected rather than reached for. */
export type ElementFromPoint = (x: number, y: number) => Element | null;

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface HitTesterOptions {
  readonly elementFromPoint: ElementFromPoint;
  readonly getViewport: () => Viewport;
  readonly getTransform?: () => ScaleTransform;
}

export interface HitTestResult {
  readonly element: Element | null;
  /** The position actually tested, after clamping. May differ from the requested position. */
  readonly position: PointerPosition;
  /** True when the requested position lay outside the viewport and was pulled back inside. */
  readonly clamped: boolean;
}

/**
 * Resolves which element sits under a pointer position.
 *
 * elementFromPoint is injected rather than called directly on document, for two reasons. It makes
 * the class testable at all, since jsdom has no layout engine and does not implement the method.
 * And it leaves room for the phase 2 native shell to supply its own resolver.
 *
 * Results are never cached across a drag. Foundry re-renders applications mid interaction, so an
 * element captured at drag start can be detached from the document by the time the drag ends, and
 * dispatching at a detached element throws the event away silently.
 */
export class HitTester {
  private readonly elementFromPoint: ElementFromPoint;
  private readonly getViewport: () => Viewport;
  private readonly getTransform: () => ScaleTransform;

  public constructor(options: HitTesterOptions) {
    this.elementFromPoint = options.elementFromPoint;
    this.getViewport = options.getViewport;
    this.getTransform = options.getTransform ?? ((): ScaleTransform => IDENTITY_TRANSFORM);
  }

  /**
   * Clamps a position into the viewport.
   *
   * Off screen positions are pulled back to the edge rather than dispatched. elementFromPoint
   * returns null outside the viewport, so an unclamped pointer that wanders past the edge would
   * stop producing events entirely and the cursor would appear frozen with no way to recover.
   */
  public clampToViewport(position: PointerPosition): PointerPosition {
    const viewport = this.getViewport();
    const maxX = Math.max(0, viewport.width - 1);
    const maxY = Math.max(0, viewport.height - 1);

    return {
      clientX: Math.min(Math.max(position.clientX, 0), maxX),
      clientY: Math.min(Math.max(position.clientY, 0), maxY),
    };
  }

  public isWithinViewport(position: PointerPosition): boolean {
    const viewport = this.getViewport();
    return (
      position.clientX >= 0 &&
      position.clientY >= 0 &&
      position.clientX < viewport.width &&
      position.clientY < viewport.height
    );
  }

  /**
   * Resolves the element under a viewport position, clamping first and converting into scaled space
   * before testing.
   */
  public resolve(position: PointerPosition): HitTestResult {
    const clamped = !this.isWithinViewport(position);
    const clampedPosition = clamped ? this.clampToViewport(position) : position;

    const transform = this.getTransform();
    const testPoint = isIdentity(transform)
      ? clampedPosition
      : toScaledSpace(clampedPosition, transform);

    const element = this.elementFromPoint(testPoint.clientX, testPoint.clientY);

    return { element, position: clampedPosition, clamped };
  }
}
