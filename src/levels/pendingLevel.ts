import { MODULE_ID } from '../constants.js';

/**
 * A pending level: the rules. Added 2026-11-14; the wiring is in startPendingLevels.ts.
 *
 * A script outside Foundry (one that writes a closed world's database) cannot level a PF2e character:
 * PF2e grants class features, and asks their ChoiceSet questions, only when the level changes inside a
 * running Foundry client. So the script writes `flags.tongs-browser.pendingLevel` instead, and the
 * designated GM's browser makes the change through PF2e, as if the GM had typed it on the sheet.
 *
 * ⚠️ The value is a JSON NUMBER, a whole number from 1 to 20. A string such as "7" is refused, not
 *    parsed: an external script relies on this shape, and a lenient reader would hide its mistakes.
 * ⚠️ Lowering is allowed. PF2e removes the class features above the new level, as it does on the sheet.
 */
export const PENDING_LEVEL_FLAG = 'pendingLevel';

const LOWEST = 1;
const HIGHEST = 20;

export type PendingLevel =
  | { readonly kind: 'none' }
  | { readonly kind: 'invalid'; readonly value: unknown }
  | { readonly kind: 'level'; readonly level: number };

/** An actor's flags, read only as far as this module's own scope. */
export interface Flagged {
  readonly flags?: Readonly<Record<string, unknown>> | null;
}

const NONE: PendingLevel = { kind: 'none' };

function ownScope(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

/** What the actor asks for: nothing, a value to refuse, or a level to apply. */
export function readPendingLevel(actor: Flagged): PendingLevel {
  const scope = ownScope(actor.flags?.[MODULE_ID]);
  if (scope === null || !Object.hasOwn(scope, PENDING_LEVEL_FLAG)) {
    return NONE;
  }
  const value = scope[PENDING_LEVEL_FLAG];
  if (value === undefined) {
    return NONE;
  }
  return typeof value === 'number' && Number.isInteger(value) && value >= LOWEST && value <= HIGHEST
    ? { kind: 'level', level: value }
    : { kind: 'invalid', value };
}

/**
 * Whether an `updateActor` change set the flag. Only a change that names it is looked at, so the level
 * and HP writes made while applying it (which fire `updateActor` too) never start a second round.
 */
export function setsPendingLevel(changes: unknown): boolean {
  const flags = ownScope(ownScope(changes)?.['flags']);
  const scope = ownScope(flags?.[MODULE_ID]);
  return scope !== null && Object.hasOwn(scope, PENDING_LEVEL_FLAG);
}

/** What the GM is told, by outcome. */
export const levelNotes = {
  levelled: (name: string, level: number): string => `Tongs levelled ${name} to ${String(level)}`,
  unchanged: (name: string, level: number): string =>
    `Tongs found ${name} already at level ${String(level)}, so PF2e granted nothing new. ` +
    'A script should write only the pending level, never the level itself.',
  invalid: (name: string, value: unknown): string =>
    `Tongs ignored the pending level ${JSON.stringify(value)} on ${name}: it must be ` +
    `a whole number from ${String(LOWEST)} to ${String(HIGHEST)}. The flag is cleared.`,
  failed: (name: string, level: number, error: unknown): string =>
    `Tongs could not level ${name} to ${String(level)}: ${error instanceof Error ? error.message : String(error)}. ` +
    'The pending level is cleared; set the level on the sheet by hand.',
};
