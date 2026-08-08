import type { Logger } from '../core/Logger.js';
import type { EventDescriptor } from '../pointer/EventDescriptor.js';

export interface DebugOverlayOptions {
  readonly document: Document;
  readonly logger: Logger;
}

/**
 * Draws an outline around whatever the pointer is currently resolving to, and logs every synthesised
 * event.
 *
 * This exists because the failure mode it diagnoses is invisible. When a tap does nothing, there is
 * no way to tell from the screen whether the pointer resolved the wrong element, resolved the right
 * one and the event was ignored, or never dispatched at all. The outline answers the first question
 * immediately, which is usually the one that matters.
 *
 * The outline element is itself pointer-events: none, for the same reason the cursor is: if it could
 * be hit tested it would become the answer to every hit test and the thing it is meant to diagnose
 * would stop working while being diagnosed.
 */
export class DebugOverlay {
  private readonly element: HTMLDivElement;
  private enabled = false;
  private attached = false;

  public constructor(private readonly options: DebugOverlayOptions) {
    this.element = options.document.createElement('div');
    this.element.className = 'tb-debug-outline';
    this.element.setAttribute('aria-hidden', 'true');
    this.element.style.pointerEvents = 'none';
    this.element.style.position = 'fixed';
    this.element.style.display = 'none';
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.options.logger.setDebugEnabled(enabled);

    if (enabled) {
      this.attach();
    } else {
      this.detach();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getElement(): HTMLDivElement {
    return this.element;
  }

  /** Called for every dispatched event while debugging. */
  public onDispatch(descriptor: EventDescriptor, target: Element): void {
    if (!this.enabled) {
      return;
    }
    this.options.logger.debug(
      `${descriptor.kind}:${descriptor.type} at ${String(descriptor.position.clientX)},` +
        `${String(descriptor.position.clientY)} on ${describeElement(target)}`
    );
    this.highlight(target);
  }

  public highlight(target: Element | null): void {
    if (!this.enabled || target === null) {
      this.element.style.display = 'none';
      return;
    }

    const rect = target.getBoundingClientRect();
    this.element.style.display = '';
    this.element.style.left = `${String(rect.left)}px`;
    this.element.style.top = `${String(rect.top)}px`;
    this.element.style.width = `${String(rect.width)}px`;
    this.element.style.height = `${String(rect.height)}px`;
  }

  private attach(): void {
    if (this.attached) {
      return;
    }
    this.options.document.body.append(this.element);
    this.attached = true;
  }

  private detach(): void {
    if (!this.attached) {
      return;
    }
    this.element.remove();
    this.attached = false;
  }
}

/** Short, readable identification of an element for a log line. */
export function describeElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id.length > 0 ? `#${element.id}` : '';
  const firstClass = element.classList.item(0);
  const className = firstClass === null ? '' : `.${firstClass}`;
  return `${tag}${id}${className}`;
}
