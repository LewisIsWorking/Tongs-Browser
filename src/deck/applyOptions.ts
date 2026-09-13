/**
 * The ways a damage card can be applied, and what each button says. Added 2026-09-13.
 *
 * ⛔ FIVE OPTIONS, mirroring PF2e 8.5.0's own damage card. The brief this was built from listed four
 * (apply, half, double, healing); reading PF2e's context menu found a fifth, TRIPLE, and a GM who
 * reaches for it on desktop must find it here too:
 *
 *     FullContext 1 · HalfContext .5 · DoubleContext 2 · TripleContext 3 · HealingContext -1
 *
 * ⚠️ A NEGATIVE MULTIPLIER IS HEALING, and it is not just a sign. PF2e computes healing as
 * `multiplier * total + addend` and passes `skipIWR: true`, while damage goes through `roll.alter`
 * with IWR applied. The adapter keys on `multiplier < 0` exactly as PF2e does (`t < 0`, `t <= 0`).
 */
export interface ApplyOption {
  readonly id: 'full' | 'half' | 'double' | 'triple' | 'healing';
  readonly multiplier: number;
  /** Short enough for a large button; the full sentence comes from `applyLabel`. */
  readonly short: string;
}

export const APPLY_OPTIONS: readonly ApplyOption[] = Object.freeze([
  { id: 'full', multiplier: 1, short: 'Apply' },
  { id: 'half', multiplier: 0.5, short: 'Half' },
  { id: 'double', multiplier: 2, short: 'Double' },
  { id: 'triple', multiplier: 3, short: 'Triple' },
  { id: 'healing', multiplier: -1, short: 'Heal' },
]);

export function isHealing(option: ApplyOption): boolean {
  return option.multiplier < 0;
}

/** `['fire']` reads "fire"; two or more read "slashing and fire"; none reads "damage". */
function describeTypes(types: readonly string[]): string {
  if (types.length === 0) {
    return 'damage';
  }
  const last = types.slice(-1).join('');
  return types.length === 1 ? last : `${types.slice(0, -1).join(', ')} and ${last}`;
}

/**
 * The whole sentence a button shows, which is the only thing a GM on a phone reads before committing.
 *
 * ⛔ `amount` IS PASSED IN, never worked out here. For half, double and triple PF2e does not multiply
 * the total: it calls `roll.alter(multiplier)`, which alters each damage instance and rounds each on
 * its own. A label computing `total * 0.5` itself would print a number PF2e does not apply whenever
 * that rounding differs, and a button whose number is wrong is worse than one with no number. The
 * adapter asks PF2e for the real figure and hands it over.
 *
 * ⚠️ It names what is SENT, not what lands. Resistances and weaknesses are applied by PF2e as the
 * damage lands and cannot be known before it does; PF2e's own damage-taken card reports the result.
 *
 * ⚠️ No target means the button asks for one, decided 2026-09-13. It never guesses a token, and never
 * falls back to the GM's selection the way PF2e's own button does.
 */
export function applyLabel(
  option: ApplyOption,
  amount: number,
  types: readonly string[],
  targetName: string | null
): string {
  if (isHealing(option)) {
    return targetName === null
      ? `Choose who to heal for ${String(amount)}`
      : `Heal ${targetName} for ${String(amount)}`;
  }

  const what = `${String(amount)} ${describeTypes(types)}`;
  const suffix = option.id === 'full' ? '' : ` (${option.short.toLowerCase()})`;
  return targetName === null
    ? `Choose who takes ${what}${suffix}`
    : `Apply ${what} to ${targetName}${suffix}`;
}
