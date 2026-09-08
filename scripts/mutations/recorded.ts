import { CREATION_MUTATIONS } from './creation.ts';
import { INTERACTION_MUTATIONS } from './interaction.ts';
import type { RecordedMutation } from './shape.ts';

export type { RecordedMutation } from './shape.ts';

/**
 * Every mutation that MUST still be caught, in one list. Split into two files 2026-09-08 when this
 * one crossed the 200 line limit, and split by WHERE the defect lives rather than by size: the
 * creation path fails on a GM's client where Foundry refuses nothing, and the input path fails with
 * every call count identical. Those are different kinds of invisible, and they read better apart.
 */
export const RECORDED: readonly RecordedMutation[] = [
  ...CREATION_MUTATIONS,
  ...INTERACTION_MUTATIONS,
];
