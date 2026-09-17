/**
 * A strike's attack card and damage card, read into what validation needs. Added 2026-09-14.
 *
 * ⛔ BUILT AGAINST MEASURED CARDS, pf2e 8.5.0, 2026-09-14 (the Nhalmika iconic's Reinforced Stock
 * against a Xorn):
 *
 *     attack  flags.pf2e.context  { type: "attack-roll", outcome, target: { token } }
 *             flags.pf2e.origin.uuid   the weapon            speaker.actor  the attacker
 *     damage  flags.pf2e.context  { type: "damage-roll", sourceType: "attack", outcome, target }
 *             flags.pf2e.origin.uuid   the SAME weapon       flags.pf2e.strike.index
 *             rolls[0]  formula "1d8 + 3 bludgeoning", total, minimumValue 4, maximumValue 11
 *
 * ⚠️ The damage card's own `outcome` is NOT evidence of a hit: a missed attack's card still offers the
 * damage button, and that damage is recorded as "success" (measured). Only the attack card says whether
 * it hit, which is why validation pairs the two.
 *
 * ⚠️ `flags[systemId]`, so SF2e's `flags.sf2e` is read on SF2e.
 */
export interface StrikeAttackFacts {
  readonly id: string;
  readonly timestamp: number;
  readonly actorId: string;
  readonly itemUuid: string;
  readonly targetToken: string | null;
  readonly outcome: string | null;
}

/**
 * One damage die PF2e recorded on the card, from `flags[systemId].dice`. PF2e writes a slug and a label for
 * every die a rule element added (`sneak-attack`, `aim`), which is what says where the die came from.
 */
export interface CardDie {
  readonly slug: string;
  readonly label: string;
  readonly diceNumber: number;
  readonly enabled: boolean;
}

export interface StrikeDamageFacts extends StrikeAttackFacts {
  readonly authorId: string | null;
  readonly strikeIndex: number;
  readonly formula: string;
  readonly total: number;
  readonly min: number;
  readonly max: number;
  /** Every die PF2e attributed, enabled or not; an unattributed one is not here at all. */
  readonly dice: readonly CardDie[];
}

export interface StrikeMessage {
  readonly id: string;
  readonly timestamp: number;
  readonly isDamageRoll?: boolean;
  readonly speaker?: { readonly actor?: string | null };
  readonly author?: { readonly id?: string } | null;
  readonly flags?: Readonly<Record<string, unknown>>;
  readonly rolls?: readonly {
    readonly formula?: string;
    readonly total?: number;
    readonly minimumValue?: number;
    readonly maximumValue?: number;
  }[];
}

interface SystemFlags {
  readonly context?: {
    readonly type?: string;
    readonly sourceType?: string;
    readonly outcome?: string | null;
    readonly target?: { readonly token?: string } | null;
  };
  readonly origin?: { readonly uuid?: string } | null;
  readonly strike?: { readonly index?: number } | null;
  readonly dice?: readonly unknown[];
}

function common(message: StrikeMessage, flags: SystemFlags): StrikeAttackFacts | null {
  const actorId = message.speaker?.actor;
  const itemUuid = flags.origin?.uuid;
  if (typeof actorId !== 'string' || typeof itemUuid !== 'string') {
    return null;
  }
  return {
    id: message.id,
    timestamp: message.timestamp,
    actorId,
    itemUuid,
    targetToken: flags.context?.target?.token ?? null,
    outcome: flags.context?.outcome ?? null,
  };
}

export function readStrikeAttack(
  message: StrikeMessage,
  systemId: string
): StrikeAttackFacts | null {
  const flags = (message.flags?.[systemId] ?? {}) as SystemFlags;
  return flags.context?.type === 'attack-roll' ? common(message, flags) : null;
}

/**
 * ⚠️ A die with no slug is dropped rather than kept as an unnamed one: PF2e always writes a slug, so a
 * damage entry without one did not come from PF2e's own damage build.
 */
function readDice(dice: readonly unknown[] | undefined): CardDie[] {
  return (dice ?? []).flatMap((each) => {
    const die = each as {
      slug?: unknown;
      label?: unknown;
      diceNumber?: unknown;
      enabled?: unknown;
    };
    return typeof die.slug === 'string' && die.slug !== '' && typeof die.label === 'string'
      ? [
          {
            slug: die.slug,
            label: die.label,
            diceNumber: typeof die.diceNumber === 'number' ? die.diceNumber : 0,
            enabled: die.enabled !== false,
          },
        ]
      : [];
  });
}

export function readStrikeDamage(
  message: StrikeMessage,
  systemId: string
): StrikeDamageFacts | null {
  const flags = (message.flags?.[systemId] ?? {}) as SystemFlags;
  const roll = message.rolls?.[0];
  const index = flags.strike?.index;
  const base = common(message, flags);
  if (
    message.isDamageRoll !== true ||
    flags.context?.sourceType !== 'attack' ||
    typeof index !== 'number' ||
    base === null ||
    typeof roll?.formula !== 'string' ||
    typeof roll.total !== 'number' ||
    typeof roll.minimumValue !== 'number' ||
    typeof roll.maximumValue !== 'number'
  ) {
    return null;
  }
  return {
    ...base,
    dice: readDice(flags.dice),
    authorId: message.author?.id ?? null,
    strikeIndex: index,
    formula: roll.formula,
    total: roll.total,
    min: roll.minimumValue,
    max: roll.maximumValue,
  };
}
