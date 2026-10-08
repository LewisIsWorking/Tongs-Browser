/**
 * The parts of a PF2e character the Roll Pad touches, every field `unknown`. Added 2026-10-08.
 *
 * Taken from PF2e 8.5's `CharacterPF2e`: `system.actions` holds strikes, each with `variants` (one per
 * multiple attack penalty step) and `damage`/`critical`; `perception`, `saves` and `skills` hold
 * statistics with a `label`, `mod`, `rank` and `roll`.
 *
 * ⚠️ Every field is optional and `unknown` on purpose: these describe what we LOOK for, and each
 * reader checks what it finds before using it.
 */
export interface ActorShape {
  readonly name?: unknown;
  readonly system?: unknown;
  readonly perception?: unknown;
  readonly saves?: unknown;
  readonly skills?: unknown;
}

export interface SystemShape {
  readonly actions?: unknown;
}

export interface StrikeShape {
  readonly type?: unknown;
  readonly label?: unknown;
  readonly visible?: unknown;
  readonly ready?: unknown;
  readonly variants?: unknown;
  readonly damage?: unknown;
  readonly critical?: unknown;
}

/** A strike's attack step, or a statistic: both are something with a label that rolls. */
export interface RollableShape {
  readonly label?: unknown;
  readonly mod?: unknown;
  readonly rank?: unknown;
  readonly roll?: unknown;
}

/** The value as a shape to look into, or null when it is not an object at all. */
export const shape = <T extends object>(value: unknown): T | null =>
  typeof value === 'object' && value !== null ? (value as T) : null;

/** Entry `index` of a list that may not be a list. */
export const entry = <T extends object>(list: unknown, index: number): T | null =>
  Array.isArray(list) ? shape<T>((list as unknown[])[index]) : null;
