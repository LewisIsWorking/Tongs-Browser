import { isBag } from './classFields.js';
import { dualClassSlugs, widenClassFilter } from './classFeatChoices.js';
import { dualClassOf } from './landDualClass.js';
import type { ClassLike } from './landDualClass.js';

/**
 * PF2e's ChoiceSet, taught that a dual class is both classes (`classFeatChoices.ts`). Added 2026-11-23.
 *
 * ⭐ THE HOOK. `ChoiceSetRuleElement.queryCompendium(choices, rollOptions, tempItems)` is where PF2e turns
 *    `choices.filter` into a Predicate and tests compendium items (read from foundryvtt/pf2e, 2026-11-23).
 *    It is wrapped once, in every browser, since the question is asked on whoever's screen adds the feat.
 * ⚠️ A COPY of the query goes in. The rule element's own `choices` are never written, so nothing new is
 *    saved on the item, and a sheet that is not a dual class gets PF2e's own query, the same object.
 * ⛔ NEVER BREAKS THE SHEET. If PF2e renames anything, nothing is wrapped; if the widening throws, PF2e's
 *    own query is used. The worst case is the old behaviour: one class's feats.
 */
const WRAPPED = Symbol.for('tongs-browser.dualClassFeatChoices');

/** The ChoiceSet rule element, as far as this reads it: the sheet it is on. */
export interface ChoiceSetLike {
  readonly actor?: { readonly items?: Iterable<ClassLike> } | null;
}

type Query = (this: ChoiceSetLike, choices: unknown, ...rest: unknown[]) => unknown;

interface RuleElementRegistry {
  readonly RuleElements?: { readonly builtin?: Readonly<Record<string, unknown>> };
}

export interface ClassFeatChoiceGlobals {
  readonly game?: { readonly pf2e?: RuleElementRegistry; readonly sf2e?: RuleElementRegistry };
}

/** Wraps the ChoiceSet query once. True when it is (or already was) wrapped, false when PF2e has none. */
export function startClassFeatChoices(globals: ClassFeatChoiceGlobals): boolean {
  const registry = globals.game?.pf2e ?? globals.game?.sf2e;
  const choiceSet = registry?.RuleElements?.builtin?.['ChoiceSet'];
  const prototype =
    typeof choiceSet === 'function'
      ? (choiceSet as { prototype?: Record<string, unknown> }).prototype
      : undefined;
  const original = prototype?.['queryCompendium'];
  if (prototype === undefined || typeof original !== 'function') {
    return false;
  }
  if ((original as unknown as Record<symbol, unknown>)[WRAPPED] === true) {
    return true;
  }
  const wrapped = function (this: ChoiceSetLike, choices: unknown, ...rest: unknown[]): unknown {
    return (original as Query).call(this, widenedQuery(this, choices), ...rest);
  };
  (wrapped as unknown as Record<symbol, unknown>)[WRAPPED] = true;
  prototype['queryCompendium'] = wrapped;
  return true;
}

/** The query PF2e should run: with both classes on a dual class's sheet, else the very same object. */
export function widenedQuery(rule: ChoiceSetLike, choices: unknown): unknown {
  try {
    const items = rule.actor?.items;
    if (!isBag(choices) || items === undefined) {
      return choices;
    }
    const dual = dualClassOf([...items]);
    const filter =
      dual === undefined ? undefined : widenClassFilter(choices['filter'], dualClassSlugs(dual));
    return filter === undefined ? choices : { ...choices, filter };
  } catch {
    return choices;
  }
}
