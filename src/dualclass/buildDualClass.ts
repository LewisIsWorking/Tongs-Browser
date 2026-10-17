import { isBag, levels, list, num, own, raise, slugOf, str, union } from './classFields.js';
import type { Bag } from './classFields.js';

/**
 * Two class items in, one dual class item out. Added 2026-10-12, ported from the community macro Lewis
 * shared that day: "The BASED dual class macro that everyone needs to be able to run across all of the
 * worlds, we should build it into TONGS".
 *
 * ⭐ Pure, and a FAITHFUL port: the first class is the base, and each rule below is the macro's, in the
 *    macro's order, with the macro's comment as its heading. Three places differ on purpose, each marked
 *    ⛔ where it happens: medium armour, the martial rule clean-up, and rules both classes share.
 *
 * ⚠️ The sources are cloned first, so neither compendium class is ever written to.
 */
export interface ClassSource {
  readonly name: string;
  readonly system: Readonly<Bag>;
}

export interface DualClassItem {
  readonly name: string;
  readonly type: 'class';
  readonly img: string;
  readonly system: Bag;
}

/** The macro's picture for every dual class item, under whichever system this world runs. */
export const dualClassImage = (systemId: string): string =>
  `systems/${systemId}/icons/spells/guidance.webp`;

export function buildDualClass(
  first: ClassSource,
  second: ClassSource,
  img: string
): DualClassItem {
  const mine = structuredClone(first.system) as Bag;
  const theirs = structuredClone(second.system) as Bag;

  mergeAttacks(own(mine, 'attacks'), own(theirs, 'attacks'));
  //Class DC
  raise(mine, theirs, 'classDC');
  mergeDefenses(own(mine, 'defenses'), own(theirs, 'defenses'));
  //Description
  const description = own(mine, 'description');
  description['value'] = `${str(description['value'])} ${str(own(theirs, 'description')['value'])}`;
  //HP
  raise(mine, theirs, 'hp');
  mergeItems(own(mine, 'items'), own(theirs, 'items'));
  //Key Ability
  union(own(mine, 'keyAbility'), own(theirs, 'keyAbility'));
  //Perception
  raise(mine, theirs, 'perception');
  mergeRules(mine, theirs, slugOf(theirs, second.name));
  //Saving Throws
  for (const save of ['fortitude', 'reflex', 'will']) {
    raise(own(mine, 'savingThrows'), own(theirs, 'savingThrows'), save);
  }
  //Skill Feat Levels, Skill Increase Levels
  levels(mine, theirs, 'skillFeatLevels');
  levels(mine, theirs, 'skillIncreaseLevels');
  //Trained Skills
  const trained = own(mine, 'trainedSkills');
  raise(trained, own(theirs, 'trainedSkills'), 'additional');
  union(trained, own(theirs, 'trainedSkills'));

  return { name: `${first.name} - ${second.name}`, type: 'class', img, system: mine };
}

//Attacks
function mergeAttacks(mine: Bag, theirs: Bag): void {
  for (const kind of ['advanced', 'martial', 'simple', 'unarmed']) {
    raise(mine, theirs, kind);
  }
  const other = own(mine, 'other');
  const theirOther = own(theirs, 'other');
  const martial = num(mine['martial']);
  /* The "other weapons" line only matters while it is at least as good as plain martial training. */
  if (martial <= num(other['rank'])) {
    if (num(theirOther['rank']) === num(other['rank'])) {
      const mashed = `${str(other['name'])}, ${str(theirOther['name'])}`.replace('and ', '');
      other['name'] = [...new Set(mashed.split(','))].join(',');
    }
    if (num(theirOther['rank']) > num(other['rank'])) {
      other['name'] = theirOther['name'];
      other['rank'] = theirOther['rank'];
    }
  }
  if (martial >= num(theirOther['rank']) && martial >= num(other['rank'])) {
    other['rank'] = 0;
    other['name'] = '';
  }
}

//Defenses
function mergeDefenses(mine: Bag, theirs: Bag): void {
  /*
   * ⛔ The macro compared `class2.heavy > dClass.medium` to decide MEDIUM armour: a typo beside three
   *    lines that each compare a field with itself. It dropped medium armour from a Wizard - Ranger (the
   *    Ranger's heavy is 0) and could LOWER it when the second class had heavy training. Fixed to compare
   *    medium with medium.
   */
  for (const armour of ['heavy', 'light', 'medium', 'unarmored']) {
    raise(mine, theirs, armour);
  }
}

//Items
function mergeItems(mine: Bag, theirs: Bag): void {
  for (const [key, entry] of Object.entries(theirs)) {
    const uuid = isBag(entry) ? entry['uuid'] : undefined;
    const level = num(isBag(entry) ? entry['level'] : undefined);
    const same = Object.values(mine).filter(
      (each): each is Bag => isBag(each) && each['uuid'] === uuid
    );
    /* Already granted at this level or sooner: keep the first class's. */
    if (same.some((each) => num(each['level']) <= level)) {
      continue;
    }
    /* Granted later by the first class: the second grants it sooner, so take that level. */
    const later = same[0];
    if (later !== undefined) {
      later['level'] = level;
      continue;
    }
    mine[key] = entry;
  }
}

//Rules
function mergeRules(mine: Bag, theirs: Bag, slug: string): void {
  const rules = list(mine, 'rules');
  rules.push({ domain: 'all', key: 'RollOption', option: `class:${slug}`, priority: 0 });
  /*
   * ⛔ The macro skipped a rule with `rules.includes(rule)`, which compares objects by identity and so
   *    never matched a rule from the other class. Compared by content here, so a rule both classes carry
   *    (a ChoiceSet with the same flag would ask twice) is added once, which is what the check was for.
   */
  const seen = new Set(rules.map((rule) => JSON.stringify(rule)));
  for (const rule of list(theirs, 'rules')) {
    if (!seen.has(JSON.stringify(rule))) {
      seen.add(JSON.stringify(rule));
      rules.push(rule);
    }
  }
  /*
   * ⛔ A rule that raises martial weapons to a rank the class already has is dropped. The macro spliced
   *    inside `forEach`, which skips the rule after each one it removes, so of two such rules in a row
   *    the second stayed. A filter removes every one.
   * ⚠️ Kept as the macro wrote it: the path must name `data`, PF2e's old field, so today's
   *    `system.` rules are never matched.
   */
  const martial = num(own(mine, 'attacks')['martial']);
  mine['rules'] = rules.filter((rule) => !raisesMartial(rule, martial));
}

function raisesMartial(rule: unknown, martial: number): boolean {
  if (!isBag(rule) || typeof rule['path'] !== 'string') {
    return false;
  }
  const path = rule['path'].split('.');
  return (
    path.includes('data') &&
    path.includes('martial') &&
    path.includes('rank') &&
    martial >= Number(rule['value'])
  );
}
