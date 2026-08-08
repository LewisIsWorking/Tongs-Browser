import {
  typeBubbles,
  typeIsCancelable,
  type DescriptorTarget,
  type MouseEventDescriptor,
  type MouseEventType,
  type PointerEventDescriptor,
  type PointerEventType,
  type WheelEventDescriptor,
} from '../EventDescriptor.js';
import type { PointerState } from '../PointerState.js';
import { NO_BUTTON_CHANGED } from '../buttons.js';

/**
 * Builders for individual descriptors.
 *
 * Every sequence goes through these rather than writing object literals, so bubbling, cancelability
 * and the button conventions are decided in exactly one place. Getting `button` wrong on a move is
 * a silent bug: zero means the left button, so a move reporting zero looks like a left button event
 * to anything inspecting it.
 */

export interface DescriptorOptions {
  readonly target?: DescriptorTarget;
  readonly button?: number;
  readonly buttons?: number;
}

export function pointerDescriptor(
  type: PointerEventType,
  state: PointerState,
  options: DescriptorOptions = {}
): PointerEventDescriptor {
  return {
    kind: 'pointer',
    type,
    target: options.target ?? 'current',
    position: state.position,
    modifiers: state.modifiers,
    bubbles: typeBubbles(type),
    cancelable: typeIsCancelable(type),
    button: options.button ?? NO_BUTTON_CHANGED,
    buttons: options.buttons ?? state.buttons,
  };
}

export function mouseDescriptor(
  type: MouseEventType,
  state: PointerState,
  options: DescriptorOptions & { detail?: number } = {}
): MouseEventDescriptor {
  return {
    kind: 'mouse',
    type,
    target: options.target ?? 'current',
    position: state.position,
    modifiers: state.modifiers,
    bubbles: typeBubbles(type),
    cancelable: typeIsCancelable(type),
    button: options.button ?? NO_BUTTON_CHANGED,
    buttons: options.buttons ?? state.buttons,
    detail: options.detail ?? 0,
  };
}

export function wheelDescriptor(
  state: PointerState,
  deltaX: number,
  deltaY: number
): WheelEventDescriptor {
  return {
    kind: 'wheel',
    type: 'wheel',
    target: 'current',
    position: state.position,
    modifiers: state.modifiers,
    bubbles: true,
    cancelable: true,
    deltaX,
    deltaY,
    // Pixel deltas. Foundry's zoom handling reads deltaY directly, and a line or page delta mode
    // would be scaled completely differently.
    deltaMode: 0,
  };
}
