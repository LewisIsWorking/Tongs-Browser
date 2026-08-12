/**
 * The shared harness for the gesture state machine suites. Extracted 2026-08-12, when that file
 * reached 407 lines.
 *
 * The machine is PURE: it never reads a clock and never sets a timer. Time arrives as a timestamp on
 * every input and timers come back as a 'timer' input, which is what lets these suites feed a list of
 * inputs and compare plain objects rather than waiting on anything.
 */

import { GestureStateMachine } from '../../../src/gesture/GestureStateMachine.js';
import {
  GestureState,
  type GestureAction,
  type GestureConfig,
  type TouchPoint,
} from '../../../src/gesture/GestureTypes.js';

/*
 * ⚠️ Re-exported so a suite needs ONE import rather than two, the harness and what it
 * harnesses. It also stops `prune:imports` removing them: an import a support module holds
 * purely to re-export is genuinely unused BY that module, and the tool is right to say so.
 */
export { GestureState, GestureStateMachine };
export type { GestureAction, GestureConfig, TouchPoint };

/**
 * The gesture machine is the part most likely to acquire "which mode am I in" bugs, so the tests
 * enumerate transitions rather than sampling them. Everything here runs in plain node: the machine
 * never reads a clock, sets a timer, or touches the DOM.
 */

export const finger = (id: number, clientX: number, clientY: number): TouchPoint => ({
  id,
  clientX,
  clientY,
});

export function machine(config: Partial<GestureConfig> = {}): GestureStateMachine {
  return new GestureStateMachine({ haptics: false, sensitivity: 1, ...config });
}

export const actionTypes = (actions: readonly GestureAction[]): string[] =>
  actions.map((action) => action.type);
