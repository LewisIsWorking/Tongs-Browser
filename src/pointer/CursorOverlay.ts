import type { PointerPosition } from './EventDescriptor.js';

export interface CursorOverlayOptions {
  readonly document: Document;
  /** Where to attach. Defaults to document.body, which is outside Foundry's #interface. */
  readonly container?: Element;
  readonly size?: number;
}

/**
 * The visible cursor.
 *
 * Attached to body rather than into Foundry's #interface so it survives application re-renders,
 * which tear down and rebuild that subtree constantly during play.
 *
 * The critical property is that it must never be hit testable. If elementFromPoint could return the
 * cursor, every hit test would resolve to the cursor itself and nothing underneath it would ever
 * receive an event. `pointer-events: none` is set both in the stylesheet and inline here, because
 * this is a correctness requirement rather than styling and it must hold even if the stylesheet
 * fails to load or another module's CSS wins the cascade.
 */
export class CursorOverlay {
  private readonly element: HTMLDivElement;
  private readonly container: Element;
  private attached = false;

  public constructor(private readonly options: CursorOverlayOptions) {
    this.container = options.container ?? options.document.body;
    this.element = options.document.createElement('div');
    this.element.className = 'tb-cursor';
    this.element.setAttribute('aria-hidden', 'true');
    this.element.style.pointerEvents = 'none';
    this.element.style.position = 'fixed';
    this.element.style.left = '0px';
    this.element.style.top = '0px';

    if (options.size !== undefined) {
      this.setSize(options.size);
    }
  }

  public attach(): void {
    if (this.attached) {
      return;
    }
    this.container.append(this.element);
    this.attached = true;
  }

  public detach(): void {
    if (!this.attached) {
      return;
    }
    this.element.remove();
    this.attached = false;
  }

  public isAttached(): boolean {
    return this.attached;
  }

  /**
   * Moves the cursor.
   *
   * Uses a transform rather than left and top so the browser can move it on the compositor without
   * a layout pass. On a mid range Android phone this is the difference between a cursor that tracks
   * the finger and one that lags behind it.
   */
  public moveTo(position: PointerPosition): void {
    this.element.style.transform = `translate3d(${String(position.clientX)}px, ${String(
      position.clientY
    )}px, 0)`;
  }

  public setSize(size: number): void {
    this.element.style.width = `${String(size)}px`;
    this.element.style.height = `${String(size)}px`;
  }

  public setVisible(visible: boolean): void {
    this.element.style.display = visible ? '' : 'none';
  }

  /** Reflects that a button is currently held, so the drag state is never ambiguous to the user. */
  public setButtonHeld(held: boolean): void {
    this.element.classList.toggle('tb-cursor--held', held);
  }

  /** Exposed for tests and for the debug overlay. Do not use it to bypass this class. */
  public getElement(): HTMLDivElement {
    return this.element;
  }

  public getDocument(): Document {
    return this.options.document;
  }
}
