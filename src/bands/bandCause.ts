/**
 * What changed an enemy's HP, in words for the GM's DM. Added 2026-09-15.
 *
 * ⛔ FROM THE PHASE 2 BRIEF: record EVERY HP change, with its cause when known ("Longsword crit from Lai,
 * fire resistance 5 applied"), and anything without a known cause as "manual change". Nothing may change
 * unrecorded.
 *
 * ⛔ THE GM'S EYES ONLY. A cause names weaknesses and resistances, which the public band must never
 * reveal. COO puts it on the DM line and never on the topic line.
 *
 * Read from PF2e's own damage-taken card, measured in pf2e 8.5.0's `applyDamage`: `flags.pf2e.origin`
 * is the item's `getOriginData()` (`{ actor, uuid }`), `appliedDamage.isHealing` says which way it went,
 * and the IWR applied is JSON in the card's `.iwr[data-applications]` as `{ category, type, adjustment }`.
 */
export const MANUAL_CAUSE = 'manual change';

/** COO refuses a longer cause, and a DM line that long is unreadable anyway. */
export const MAX_CAUSE_LENGTH = 200;

export interface IwrApplication {
  readonly category: string;
  readonly type: string;
  readonly adjustment: number;
}

export interface CauseFacts {
  readonly itemName: string | null;
  readonly actorName: string | null;
  readonly healing: boolean;
  readonly iwr: readonly IwrApplication[];
}

const signed = (value: number) => (value > 0 ? `+${String(value)}` : String(value));

/** "Longsword from Lai; resistance fire -5", "healed by Heal from Kyra", or "manual change". */
export function describeCause(facts: CauseFacts | null): string {
  if (facts === null) {
    return MANUAL_CAUSE;
  }
  const names = [facts.itemName, facts.actorName].filter((name): name is string => name !== null);
  const source = names.length === 0 ? null : names.join(' from ');
  const what = facts.healing
    ? source === null
      ? 'healing applied'
      : `healed by ${source}`
    : (source ?? 'damage applied');
  const iwr = facts.iwr.map((each) => `${each.category} ${each.type} ${signed(each.adjustment)}`);
  const text = iwr.length === 0 ? what : `${what}; ${iwr.join(', ')}`;
  return text.length > MAX_CAUSE_LENGTH ? `${text.slice(0, MAX_CAUSE_LENGTH - 3)}...` : text;
}
