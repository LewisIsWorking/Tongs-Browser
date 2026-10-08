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

/** Any object, to look into by key. */
export type Bag = Readonly<Record<string, unknown>>;

const object = (value: unknown): object | null =>
  typeof value === 'object' && value !== null ? value : null;

export const asActor = (value: unknown) => object(value) as ActorShape | null;
export const asSystem = (value: unknown) => object(value) as SystemShape | null;
export const asStrike = (value: unknown) => object(value) as StrikeShape | null;
export const asRollable = (value: unknown) => object(value) as RollableShape | null;
export const asBag = (value: unknown) => object(value) as Bag | null;

/** Entry `index` of a list that may not be a list. */
export const entry = (list: unknown, index: number): unknown =>
  Array.isArray(list) ? (list as unknown[])[index] : undefined;
