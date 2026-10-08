import { asActor, asBag, asRollable, asStrike, asSystem } from './pf2eShapes.js';

/**
 * What the Roll Pad offers for one character, read from the PF2e actor. Added 2026-10-08.
 *
 * Lewis, 2026-10-05: "IT would be good to be able to roll from Mobile a lot easier." The sheet is
 * small and fiddly on a phone, so the pad lists the rolls a player actually makes, as big buttons.
 *
 * ⚠️ Read DEFENSIVELY, as `unknown`. The actor is PF2e's, and its shape is not ours: a strike, a
 * statistic or a label that is missing drops that one button, never the pad.
 *
 * ⚠️ A strike keeps its INDEX in `system.actions`, because that is how `padRolls.ts` finds it again at
 * the moment of rolling. The pad never holds PF2e's own objects, so a sheet that changed while the
 * pad was open rolls what the actor has now.
 */
export interface PadStrike {
  readonly index: number;
  readonly label: string;
  /** One label per multiple attack penalty step, as PF2e writes them. */
  readonly attacks: readonly string[];
  readonly canDamage: boolean;
  readonly canCritical: boolean;
  /**
   * False when PF2e thinks the weapon is not in hand. The pad SAYS so and still rolls: PF2e 8.5 rolls
   * it anyway (measured 2026-10-08), and players seldom keep hand tracking up to date.
   */
  readonly ready: boolean;
}

export type CheckGroup = 'perception' | 'save' | 'skill';

export interface PadCheck {
  readonly group: CheckGroup;
  readonly key: string;
  readonly label: string;
  readonly modifier: number | null;
  readonly trained: boolean;
}

export interface PadModel {
  readonly name: string;
  readonly strikes: readonly PadStrike[];
  /** Perception, then Fortitude, Reflex and Will. */
  readonly checks: readonly PadCheck[];
  /** Trained skills first, each half in alphabetical order. Lores are skills too. */
  readonly skills: readonly PadCheck[];
}

const SAVES = ['fortitude', 'reflex', 'will'] as const;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const isRoll = (value: unknown): boolean => typeof value === 'function';

function readStrike(value: unknown, index: number): PadStrike | null {
  const strike = asStrike(value);
  const label = text(strike?.label);
  if (strike === null || label === null || strike.type !== 'strike' || strike.visible === false) {
    return null;
  }
  const variants = Array.isArray(strike.variants) ? (strike.variants as unknown[]) : [];
  const attacks = variants.flatMap((variant) => {
    const each = asRollable(variant);
    const name = text(each?.label);
    return name !== null && isRoll(each?.roll) ? [name] : [];
  });
  return {
    index,
    label,
    attacks,
    canDamage: isRoll(strike.damage),
    canCritical: isRoll(strike.critical),
    ready: strike.ready !== false,
  };
}

function readCheck(group: CheckGroup, key: string, value: unknown): PadCheck | null {
  const statistic = asRollable(value);
  const label = text(statistic?.label);
  if (statistic === null || label === null || !isRoll(statistic.roll)) {
    return null;
  }
  const modifier = typeof statistic.mod === 'number' ? statistic.mod : null;
  const rank = typeof statistic.rank === 'number' ? statistic.rank : 0;
  return { group, key, label, modifier, trained: rank > 0 };
}

const byTrainedThenName = (a: PadCheck, b: PadCheck): number =>
  Number(b.trained) - Number(a.trained) || a.label.localeCompare(b.label);

/** The pad for this actor, or null when it is not a character PF2e can roll for. */
export function readPad(actor: unknown): PadModel | null {
  const self = asActor(actor);
  const name = text(self?.name);
  if (self === null || name === null) {
    return null;
  }
  const actions = asSystem(self.system)?.actions;
  const strikes = (Array.isArray(actions) ? (actions as unknown[]) : []).flatMap((each, index) => {
    const strike = readStrike(each, index);
    return strike === null ? [] : [strike];
  });
  const saves = asBag(self.saves);
  const checks = [
    readCheck('perception', 'perception', self.perception),
    ...SAVES.map((key) => readCheck('save', key, saves?.[key])),
  ].flatMap((check) => (check === null ? [] : [check]));
  const skills = Object.entries(asBag(self.skills) ?? {})
    .flatMap(([key, value]) => {
      const skill = readCheck('skill', key, value);
      return skill === null ? [] : [skill];
    })
    .sort(byTrainedThenName);
  return { name, strikes, checks, skills };
}

/** "+7" or "-1", for the label on a check's button. */
export const signed = (modifier: number): string =>
  modifier < 0 ? String(modifier) : `+${String(modifier)}`;
