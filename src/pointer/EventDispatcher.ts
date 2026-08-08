import { VIRTUAL_POINTER_ID } from '../constants.js';
import type {
  EventDescriptor,
  MouseEventDescriptor,
  PointerEventDescriptor,
  WheelEventDescriptor,
} from './EventDescriptor.js';

/**
 * Elements a descriptor's symbolic target can resolve to.
 *
 * Sequences name their target as 'current' or 'previous' because they are pure and cannot perform
 * hit tests. The dispatcher supplies the actual elements.
 */
export interface DispatchTargets {
  readonly current: Element | null;
  readonly previous: Element | null;
}

export interface EventDispatcherOptions {
  /**
   * The window used as the event's `view` and as the source of screen coordinates.
   *
   * Optional, and genuinely so. Vitest exposes jsdom's globals on a plain object rather than a
   * branded Window, and the UIEvent constructor rejects it with "member view is not of type
   * Window". Tests therefore run without a view, while real browsers get one.
   */
  readonly view?: Window | null;
  /** Called for every dispatched event when debug logging is on. */
  readonly onDispatch?: (descriptor: EventDescriptor, target: Element) => void;
}

/**
 * Turns event descriptors into real DOM events and dispatches them.
 *
 * This is deliberately the only place in the module that constructs or dispatches events. Every
 * decision about what to send lives in the pure sequence builders, which keeps that logic testable
 * without a DOM and keeps this class small enough to verify by reading.
 *
 * Both families are dispatched. PIXI's federated EventSystem, which Foundry's canvas runs on,
 * prefers PointerEvent when the browser provides it. Plenty of Foundry HTML chrome and third party
 * modules still bind mousedown and click directly. Sending only one family works in half the
 * interface and fails silently in the other half.
 */
export class EventDispatcher {
  private readonly view: Window | null;
  private readonly onDispatch: ((descriptor: EventDescriptor, target: Element) => void) | undefined;

  public constructor(options: EventDispatcherOptions = {}) {
    this.view = options.view ?? null;
    this.onDispatch = options.onDispatch;
  }

  /**
   * Dispatches a whole sequence in order.
   *
   * Descriptors whose target resolves to nothing are skipped rather than treated as an error. A
   * move that leaves an element and enters nothing is ordinary, and so is the first move of all,
   * where there is no previous element.
   */
  public dispatchAll(descriptors: readonly EventDescriptor[], targets: DispatchTargets): void {
    for (const descriptor of descriptors) {
      const target = descriptor.target === 'current' ? targets.current : targets.previous;
      if (target === null) {
        continue;
      }
      this.dispatchOne(descriptor, target);
    }
  }

  public dispatchOne(descriptor: EventDescriptor, target: Element): void {
    const event = this.createEvent(descriptor);
    target.dispatchEvent(event);
    this.onDispatch?.(descriptor, target);
  }

  private createEvent(descriptor: EventDescriptor): Event {
    switch (descriptor.kind) {
      case 'pointer':
        return this.createPointerEvent(descriptor);
      case 'mouse':
        return this.createMouseEvent(descriptor);
      case 'wheel':
        return this.createWheelEvent(descriptor);
    }
  }

  /**
   * Fields shared by every event this dispatcher produces.
   *
   * `composed` matters more than it looks: without it, events do not cross shadow DOM boundaries,
   * and any module rendering into a shadow root would stop receiving them.
   *
   * `pageX` and `pageY` are absent on purpose. They are not settable through any event constructor;
   * the browser derives them from clientX plus scroll offset. Setting clientX correctly is what
   * makes them come out right.
   */
  private baseInit(descriptor: EventDescriptor): MouseEventInit {
    const screenOffsetX = this.view?.screenX ?? 0;
    const screenOffsetY = this.view?.screenY ?? 0;

    return {
      bubbles: descriptor.bubbles,
      cancelable: descriptor.cancelable,
      composed: true,
      ...(this.view === null ? {} : { view: this.view }),
      clientX: descriptor.position.clientX,
      clientY: descriptor.position.clientY,
      screenX: descriptor.position.clientX + screenOffsetX,
      screenY: descriptor.position.clientY + screenOffsetY,
      ctrlKey: descriptor.modifiers.ctrlKey,
      shiftKey: descriptor.modifiers.shiftKey,
      altKey: descriptor.modifiers.altKey,
      metaKey: descriptor.modifiers.metaKey,
    };
  }

  private createPointerEvent(descriptor: PointerEventDescriptor): PointerEvent {
    return new PointerEvent(descriptor.type, {
      ...this.baseInit(descriptor),
      button: descriptor.button,
      buttons: descriptor.buttons,
      // A reserved id well above anything the browser assigns to a real finger, so the native touch
      // suppressor can always tell our pointer apart from a genuine one.
      pointerId: VIRTUAL_POINTER_ID,
      pointerType: 'mouse',
      isPrimary: true,
      width: 1,
      height: 1,
      pressure: descriptor.buttons === 0 ? 0 : 0.5,
    });
  }

  private createMouseEvent(descriptor: MouseEventDescriptor): MouseEvent {
    return new MouseEvent(descriptor.type, {
      ...this.baseInit(descriptor),
      button: descriptor.button,
      buttons: descriptor.buttons,
      detail: descriptor.detail,
    });
  }

  private createWheelEvent(descriptor: WheelEventDescriptor): WheelEvent {
    return new WheelEvent(descriptor.type, {
      ...this.baseInit(descriptor),
      deltaX: descriptor.deltaX,
      deltaY: descriptor.deltaY,
      deltaMode: descriptor.deltaMode,
    });
  }
}
