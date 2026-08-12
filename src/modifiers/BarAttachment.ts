/**
 * Putting the bar into the page and taking it out again. Extracted from ModifierBar 2026-08-12.
 *
 * Small, but it owns the two moments that are easy to get wrong: when a clamp can first succeed, and
 * what must be released before the bar disappears.
 */
export interface BarAttachmentOptions {
  readonly document: Document;
  readonly element: HTMLElement;
  /**
   * Re-clamp against the room actually available.
   *
   * ⚠️ Called AFTER the element is in the document, which is the first moment it has a size.
   *
   * A constructor clamp cannot possibly succeed: an element that is not in the DOM reports
   * `offsetWidth` 0, every position fits inside a width of zero, and the clamp is a no op BY
   * CONSTRUCTION. So the clamp existed and only ever really ran on a drag. Measured on a 412px phone,
   * the bar still opened across the sidebar, because opening is not dragging.
   */
  readonly onLayoutAvailable: () => void;
  /**
   * ⚠️ Release anything held BEFORE disappearing, or Foundry is left believing shift is down with no
   * visible way for the user to clear it: the bar that would have shown it is gone.
   */
  readonly onDetaching: () => void;
}

export class BarAttachment {
  private attached = false;

  public constructor(private readonly options: BarAttachmentOptions) {}

  public isAttached(): boolean {
    return this.attached;
  }

  public attach(): void {
    if (this.attached) {
      return;
    }
    this.options.document.body.append(this.options.element);
    this.attached = true;

    // Reading the size here forces layout, so it is real by the time the clamp uses it.
    this.options.onLayoutAvailable();

    /*
     * A rotation, or a sidebar that expands, changes the room available. A position that fitted a
     * moment ago can be off screen or over the sidebar now, and nothing else would notice.
     */
    this.options.document.defaultView?.addEventListener('resize', this.onViewportChanged);
  }

  public detach(): void {
    if (!this.attached) {
      return;
    }
    this.options.onDetaching();
    this.options.document.defaultView?.removeEventListener('resize', this.onViewportChanged);
    this.options.element.remove();
    this.attached = false;
  }

  /** Re-clamp, but only while attached: an unattached element has no size to clamp against. */
  public reclamp(): void {
    if (this.attached) {
      this.options.onLayoutAvailable();
    }
  }

  private readonly onViewportChanged = (): void => {
    this.options.onLayoutAvailable();
  };
}
