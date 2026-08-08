import type { ModifierFlags } from './ModifierFlags.js';

/**
 * Pure descriptions of events to be dispatched. No DOM types appear here, which is what lets the
 * sequence builders be tested in plain node with no jsdom involved.
 */

export type PointerEventType =
  | 'pointerover'
  | 'pointerenter'
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'pointerout'
  | 'pointerleave'
  | 'pointercancel';

export type MouseEventType =
  | 'mouseover'
  | 'mouseenter'
  | 'mousedown'
  | 'mousemove'
  | 'mouseup'
  | 'mouseout'
  | 'mouseleave'
  | 'click'
  | 'dblclick'
  | 'contextmenu';

/**
 * Which element the dispatcher should aim this event at.
 *
 * Sequences cannot resolve elements themselves without reaching into the DOM, so they name the
 * target symbolically and the dispatcher resolves it. Hover transitions need both: the element
 * being left and the element being entered.
 */
export type DescriptorTarget = 'current' | 'previous';

export interface PointerPosition {
  readonly clientX: number;
  readonly clientY: number;
}

interface DescriptorBase {
  readonly target: DescriptorTarget;
  readonly position: PointerPosition;
  readonly modifiers: ModifierFlags;
  readonly bubbles: boolean;
  readonly cancelable: boolean;
}

export interface PointerEventDescriptor extends DescriptorBase {
  readonly kind: 'pointer';
  readonly type: PointerEventType;
  readonly button: number;
  readonly buttons: number;
}

export interface MouseEventDescriptor extends DescriptorBase {
  readonly kind: 'mouse';
  readonly type: MouseEventType;
  readonly button: number;
  readonly buttons: number;
  /** Click count. 1 for a single click, 2 for the dblclick that follows a double click. */
  readonly detail: number;
}

export interface WheelEventDescriptor extends DescriptorBase {
  readonly kind: 'wheel';
  readonly type: 'wheel';
  readonly deltaX: number;
  readonly deltaY: number;
  /** 0 means pixel deltas, which is what Foundry's zoom handling expects. */
  readonly deltaMode: 0;
}

export type EventDescriptor = PointerEventDescriptor | MouseEventDescriptor | WheelEventDescriptor;

/**
 * Enter and leave events do not bubble and are not cancelable, in either the pointer or mouse
 * family. Encoding that here rather than at each call site means a sequence cannot get it wrong,
 * and a listener bound on a container will not see spurious enter events from its descendants.
 */
const NON_BUBBLING_TYPES: ReadonlySet<string> = new Set([
  'pointerenter',
  'pointerleave',
  'mouseenter',
  'mouseleave',
]);

export function typeBubbles(type: PointerEventType | MouseEventType | 'wheel'): boolean {
  return !NON_BUBBLING_TYPES.has(type);
}

export function typeIsCancelable(type: PointerEventType | MouseEventType | 'wheel'): boolean {
  return !NON_BUBBLING_TYPES.has(type);
}
