/**
 * Small, safe readers and writers over a class item's `system`, for `buildDualClass`. Added 2026-10-12.
 *
 * ⚠️ The macro read every field as if it were there (`class2.system.attacks.other.rank`), which is true
 *    of PF2e's own classes and not of every class compendium it lists. A field that is missing reads
 *    as 0, "" or empty here, so a playtest class with a gap merges instead of throwing.
 */
export type Bag = Record<string, unknown>;

export const isBag = (value: unknown): value is Bag =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const num = (value: unknown): number => (typeof value === 'number' ? value : 0);

export const str = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The object at `key`, made and stored on `bag` when it is missing, so writes to it land. */
export function own(bag: Bag, key: string): Bag {
  const value = bag[key];
  if (isBag(value)) {
    return value;
  }
  const made: Bag = {};
  bag[key] = made;
  return made;
}

/** The array at `key`, made and stored on `bag` when it is missing. */
export function list(bag: Bag, key: string): unknown[] {
  const value = bag[key];
  if (Array.isArray(value)) {
    return value as unknown[];
  }
  const made: unknown[] = [];
  bag[key] = made;
  return made;
}

/** The macro's `if (class2.x > dClass.x) dClass.x = class2.x`: the better of the two ranks. */
export function raise(mine: Bag, theirs: Bag, key: string): void {
  if (num(theirs[key]) > num(mine[key])) {
    mine[key] = theirs[key];
  }
}

/** The macro's key ability and trained skill merge: the second's values added, none twice, in order. */
export function union(mine: Bag, theirs: Bag): void {
  const values = list(mine, 'value');
  for (const value of list(theirs, 'value')) {
    if (!values.includes(value)) {
      values.push(value);
    }
  }
}

/** The macro's skill feat and skill increase levels: both lists, each level once, lowest first. */
export function levels(mine: Bag, theirs: Bag, key: string): void {
  const target = own(mine, key);
  const all = [...list(target, 'value'), ...list(own(theirs, key), 'value')];
  target['value'] = [...new Set(all)].sort((a, b) => num(a) - num(b));
}

/** PF2e's own slug rule, near enough for a roll option: lower case, words joined by hyphens. */
export function slugOf(system: Bag, name: string): string {
  const slug = str(system['slug']);
  return slug !== ''
    ? slug
    : name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
