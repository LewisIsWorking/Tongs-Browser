/**
 * The shared harness for the event sequence builders. Extracted 2026-08-12.
 *
 * These builders are pure: they take a state and return a LIST of descriptors, dispatching nothing.
 * That is what lets the order of a click, a drag or a hover transition be asserted exactly, rather
 * than inferred from what a browser happened to deliver.
 */

import type { EventDescriptor } from '../../../src/pointer/EventDescriptor.js';
import { createModifierFlags } from '../../../src/pointer/ModifierFlags.js';
import { createPointerState } from '../../../src/pointer/PointerState.js';
import { ButtonsMask, MouseButton, NO_BUTTON_CHANGED } from '../../../src/pointer/buttons.js';
import {
  buildDoubleClickSequence,
  buildLeftClickSequence,
  buildRightClickSequence,
} from '../../../src/pointer/sequences/clickSequence.js';
import {
  buildDragEndSequence,
  buildDragMoveSequence,
  buildDragStartSequence,
} from '../../../src/pointer/sequences/dragSequence.js';
import { buildMoveSequence } from '../../../src/pointer/sequences/moveSequence.js';
import { buildWheelSequence } from '../../../src/pointer/sequences/wheelSequence.js';

/*
 * ⚠️ Re-exported so a suite needs ONE import rather than two, the harness and what it
 * harnesses. It also stops `prune:imports` removing them: an import a support module holds
 * purely to re-export is genuinely unused BY that module, and the tool is right to say so.
 */
export {
  ButtonsMask,
  MouseButton,
  NO_BUTTON_CHANGED,
  buildDoubleClickSequence,
  buildDragEndSequence,
  buildDragMoveSequence,
  buildDragStartSequence,
  buildLeftClickSequence,
  buildMoveSequence,
  buildRightClickSequence,
  buildWheelSequence,
  createModifierFlags,
  createPointerState,
};
export type { EventDescriptor };

/**
 * These run in the node project with no DOM available. If a sequence builder ever reaches for
 * document or window, these tests break immediately rather than passing quietly under jsdom.
 */

export const at = (clientX: number, clientY: number) => createPointerState({ clientX, clientY });

export const types = (descriptors: readonly EventDescriptor[]): string[] =>
  descriptors.map((descriptor) => descriptor.type);

export const targets = (descriptors: readonly EventDescriptor[]): string[] =>
  descriptors.map((descriptor) => descriptor.target);
