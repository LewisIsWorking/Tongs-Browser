import { APPLY_OPTIONS } from './applyOptions.js';
import type { ApplyOption } from './applyOptions.js';

/**
 * What each apply button would send, asked of PF2e rather than worked out. Added 2026-09-14.
 *
 * ⛔ HALF, DOUBLE AND TRIPLE COME FROM `roll.alter(multiplier, 0)`, PF2e's own, because PF2e alters
 * each damage instance and rounds each on its own. Measured 2026-09-13: half of a 6 made of 5 piercing
 * and 1 fire is 2, not 3. See `applyLabel`, which prints whatever this hands it.
 *
 * ⚠️ `alter` does not touch the message's roll. Read in pf2e 8.5.0: for an evaluated roll with damage
 * instances (the only kind the deck reads) it builds new instances from clones and returns a new roll.
 * Only an unevaluated roll falls through to Foundry's mutating `Roll#alter`, and those never reach here.
 *
 * ⚠️ Healing sends the plain total: PF2e heals by `multiplier * total` with IWR skipped.
 */
export type DamageAmounts = Readonly<Partial<Record<ApplyOption['id'], number>>>;

export interface AlterableRoll {
  readonly total?: number;
  readonly alter?: (multiplier: number, addend: number) => { readonly total?: number };
}

/**
 * ⚠️ An option PF2e cannot price is LEFT OUT, never guessed: a missing `alter`, a throw, or a total that
 * is not a number means that button is not offered, rather than offered with a figure PF2e will not use.
 */
function altered(roll: AlterableRoll, multiplier: number): number | null {
  try {
    const total = roll.alter?.(multiplier, 0).total;
    return typeof total === 'number' && Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

export function damageAmounts(roll: AlterableRoll): DamageAmounts {
  const total = roll.total ?? 0;
  const amounts: Partial<Record<ApplyOption['id'], number>> = {};
  for (const option of APPLY_OPTIONS) {
    const amount =
      option.multiplier === 1 || option.multiplier < 0 ? total : altered(roll, option.multiplier);
    if (amount !== null) {
      amounts[option.id] = amount;
    }
  }
  return amounts;
}
