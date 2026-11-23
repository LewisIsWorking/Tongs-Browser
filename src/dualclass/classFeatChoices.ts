import { isBag, slugOf } from './classFields.js';
import { isDualClass } from './landDualClass.js';
import type { ClassLike } from './landDualClass.js';

/**
 * A dual class's "class feat of your class" questions offer both classes. Added 2026-11-23, after a
 * Thaumaturge - Cleric's Natural Ambition listed only thaumaturge feats when the player wanted the cleric's
 * Healing Hands.
 *
 * ⚠️ WHY IT HAPPENS. A dual class is ONE class item, built from the first class, so PF2e sets the sheet's
 *    `system.details.class.trait` to that one slug. Natural Ambition's ChoiceSet filters on
 *    `item:trait:{actor|system.details.class.trait}`, so the second class's feats can never be listed.
 * ⭐ THE RULE. In the Dual Class variant you count as both classes, so "a class feat of your class" is
 *    a feat of either. The pure half is here; the PF2e wiring is `startClassFeatChoices.ts`.
 */

/** A filter entry naming the sheet's class by a path: `item:trait:{actor|system.details.class.trait}` and kin. */
const CLASS_TRAIT = /^item:trait:\{actor\|[\w.]*class[\w.]*\}$/;

/** The predicate keys whose values are themselves predicate statements (PF2e's `Predicate`). */
const NESTED = ['and', 'or', 'nand', 'nor', 'not'] as const;

/**
 * Every class a dual class counts as, or nothing when the item is not a dual class: its own slug (from the
 * first half of its name when it has none, as the macro's "Class1 - Class2" would otherwise slug to
 * "class1-class2"), each `class:` roll option, and each half of its name.
 */
export function dualClassSlugs(item: ClassLike): string[] {
  if (!isDualClass(item)) {
    return [];
  }
  const system = isBag(item.system) ? item.system : {};
  const halves = (item.name ?? '').split(' - ');
  const slugs = new Set([slugOf(system, halves.slice(0, 1).join(''))]);
  /* ⚠️ Read, never `list()`: that stores a missing array on the bag, and this is a live item's data. */
  const rules: unknown[] = Array.isArray(system.rules) ? system.rules : [];
  for (const rule of rules) {
    const option = isBag(rule) && rule['key'] === 'RollOption' ? rule['option'] : undefined;
    if (typeof option === 'string' && option.startsWith('class:')) {
      slugs.add(option.slice('class:'.length));
    }
  }
  if (halves.length > 1) {
    halves.forEach((half) => slugs.add(slugOf({}, half)));
  }
  slugs.delete('');
  return slugs.size > 1 ? [...slugs] : [];
}

/**
 * A ChoiceSet filter with every class-trait entry, however deeply nested, widened to any of `slugs`; or
 * undefined when there is nothing to widen, so the caller passes PF2e's own filter on untouched.
 */
export function widenClassFilter(filter: unknown, slugs: readonly string[]): unknown[] | undefined {
  if (!Array.isArray(filter) || slugs.length < 2) {
    return undefined;
  }
  const state = { changed: false };
  const widened = filter.map((entry) => widen(entry, slugs, state));
  return state.changed ? widened : undefined;
}

function widen(entry: unknown, slugs: readonly string[], state: { changed: boolean }): unknown {
  if (typeof entry === 'string') {
    if (!CLASS_TRAIT.test(entry)) {
      return entry;
    }
    state.changed = true;
    return { or: slugs.map((slug) => `item:trait:${slug}`) };
  }
  if (Array.isArray(entry)) {
    return entry.map((inner) => widen(inner, slugs, state));
  }
  if (!isBag(entry)) {
    return entry;
  }
  const copy: Record<string, unknown> = { ...entry };
  for (const key of NESTED) {
    if (key in copy) {
      copy[key] = widen(copy[key], slugs, state);
    }
  }
  return copy;
}
