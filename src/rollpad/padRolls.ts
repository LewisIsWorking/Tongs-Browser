import type { CheckGroup } from './padModel.js';
import { entry, shape } from './pf2eShapes.js';
import type { ActorShape, SystemShape } from './pf2eShapes.js';

/**
 * Making PF2e roll what a Roll Pad button names. Added 2026-10-08.
 *
 * ⭐ PF2E ROLLS, NOT US. Every button calls the method PF2e's own sheet calls, so the result arrives
 * in chat as PF2e's own card with every modifier, trait and rule element applied, and the GM sees
 * nothing different from a roll made on the sheet:
 *
 *   attack     actor.system.actions[i].variants[v].roll(params)
 *   damage     actor.system.actions[i].damage(params)
 *   critical   actor.system.actions[i].critical(params)
 *   perception actor.perception.roll(params)
 *   save       actor.saves[key].roll(params)
 *   skill      actor.skills[key].roll(params)
 *
 * ⚠️ `skipDialog` is said EXPLICITLY both ways. Left out, PF2e decides from the player's own "show
 * check dialogs" setting, and a tap would sometimes open a dialog. A tap rolls; a long press asks.
 */
export type PadRoll =
  | {
      readonly kind: 'attack';
      readonly strike: number;
      readonly variant: number;
    }
  | { readonly kind: 'damage' | 'critical'; readonly strike: number }
  | { readonly kind: 'check'; readonly group: CheckGroup; readonly key: string };

type Bag = Readonly<Record<string, unknown>>;
type RollMethod = (params: { skipDialog: boolean }) => unknown;

/** The object the method belongs to, and the method's name on it. */
function locate(actor: ActorShape, roll: PadRoll): [Bag | null, string] {
  if (roll.kind === 'check') {
    if (roll.group === 'perception') {
      return [shape<Bag>(actor.perception), 'roll'];
    }
    const statistics = shape<Bag>(roll.group === 'save' ? actor.saves : actor.skills);
    return [shape<Bag>(statistics?.[roll.key]), 'roll'];
  }
  const strike = entry<Bag>(shape<SystemShape>(actor.system)?.actions, roll.strike);
  return roll.kind === 'attack'
    ? [entry<Bag>(strike?.['variants'], roll.variant), 'roll']
    : [strike, roll.kind];
}

/**
 * Roll it, returning false when the actor has no such roll any more.
 *
 * ⚠️ Called ON its own object (`owner[name](...)`), never detached: PF2e's statistics read `this`.
 */
export async function rollOnPad(actor: unknown, roll: PadRoll, ask: boolean): Promise<boolean> {
  const self = shape<ActorShape>(actor);
  const [owner, name] = self === null ? [null, ''] : locate(self, roll);
  const method = owner?.[name];
  if (owner === null || typeof method !== 'function') {
    return false;
  }
  await (method as RollMethod).call(owner, { skipDialog: !ask });
  return true;
}
