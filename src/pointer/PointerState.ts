import { ButtonsMask } from './buttons.js';
import type { PointerPosition } from './EventDescriptor.js';
import { NO_MODIFIERS, type ModifierFlags } from './ModifierFlags.js';

/**
 * Immutable snapshot of the virtual pointer at one instant.
 *
 * Sequence builders take one of these and return event descriptors. Nothing here is mutated in
 * place: every transition produces a new state, so a sequence can never observe the pointer moving
 * underneath it while it builds.
 */
export interface PointerState {
  readonly position: PointerPosition;
  /** Bitmask of currently held buttons. See ButtonsMask. */
  readonly buttons: number;
  readonly modifiers: ModifierFlags;
}

export function createPointerState(
  position: PointerPosition = { clientX: 0, clientY: 0 },
  buttons: number = ButtonsMask.NONE,
  modifiers: ModifierFlags = NO_MODIFIERS
): PointerState {
  return Object.freeze({ position: Object.freeze({ ...position }), buttons, modifiers });
}

export function withPosition(state: PointerState, position: PointerPosition): PointerState {
  return createPointerState(position, state.buttons, state.modifiers);
}

export function withButtons(state: PointerState, buttons: number): PointerState {
  return createPointerState(state.position, buttons, state.modifiers);
}

export function withModifiers(state: PointerState, modifiers: ModifierFlags): PointerState {
  return createPointerState(state.position, state.buttons, modifiers);
}

/** Moves the pointer by a relative delta. This is the trackpad mode primitive. */
export function translated(state: PointerState, deltaX: number, deltaY: number): PointerState {
  return withPosition(state, {
    clientX: state.position.clientX + deltaX,
    clientY: state.position.clientY + deltaY,
  });
}
