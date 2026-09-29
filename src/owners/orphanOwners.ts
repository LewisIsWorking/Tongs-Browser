/**
 * Finding what Forge-era players owned, and giving it to their new users. Added 2026-09-29.
 *
 * ⛔ WHY. Moving the worlds off The Forge deleted every player's old Foundry user (clear-players.mjs), and
 * ComeOnOverUno made each of them a new one. Nothing was lost: every character, item and journal a player
 * owned still names their OLD user id in its ownership. That id now matches nobody, so to the player it
 * looks gone ("The custom shit i made is gone"), and a GM had to reassign character by character.
 *
 * ⛔ NO NAME MATCHING. The old users' names were deleted with them, and Lewis turned down adopting users by
 * name on 2026-09-20 because it can hand somebody another player's character. So this only GROUPS the
 * orphaned ids with what each owned ("Kitt, Cyrus, Rune, Zels"), and the GM says who that is.
 *
 * ⚠️ ADDS, NEVER REMOVES. The new user gets the old user's level (or keeps a higher one they already have).
 *    The old id stays in place, so nothing here is one-way, and a group already given away is recognised
 *    by its saved answer rather than by the old id disappearing.
 */
export interface OwnedDoc {
  readonly collection: string;
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly ownership: Readonly<Record<string, number>>;
}

export interface OrphanGroup {
  readonly oldId: string;
  readonly docs: readonly OwnedDoc[];
}

export interface OwnershipUpdate {
  readonly collection: string;
  readonly update: Readonly<Record<string, string | number>>;
}

const OWNER_ID = /^[A-Za-z0-9]{16}$/;

/** Every user id that owns something here but is not a user of this world, most-owning first. */
export function orphanGroups(docs: readonly OwnedDoc[], users: ReadonlySet<string>): OrphanGroup[] {
  const byId = new Map<string, OwnedDoc[]>();
  for (const doc of docs) {
    for (const [id, level] of Object.entries(doc.ownership)) {
      if (!OWNER_ID.test(id) || users.has(id) || typeof level !== 'number' || level <= 0) {
        continue;
      }
      byId.set(id, [...(byId.get(id) ?? []), doc]);
    }
  }
  return [...byId.entries()]
    .map(([oldId, owned]) => ({ oldId, docs: owned }))
    .sort((a, b) => b.docs.length - a.docs.length || a.oldId.localeCompare(b.oldId));
}

/** How a group reads to a GM: characters first, because those are what they will recognise. */
export function describeGroup(group: OrphanGroup, shown = 6): string {
  const characters = group.docs.filter((d) => d.collection === 'Actor' && d.type === 'character');
  const rest = group.docs.filter((d) => !characters.includes(d));
  const names = [...characters, ...rest].map((d) => d.name);
  const more = names.length - shown;
  return names.slice(0, shown).join(', ') + (more > 0 ? ` and ${String(more)} more` : '');
}

/**
 * The updates that give each group to the user the GM chose. `choices` maps an old id to a current user id;
 * anything unchosen, or chosen as someone who is not a user here, is left alone.
 */
export function ownershipUpdates(
  groups: readonly OrphanGroup[],
  choices: Readonly<Record<string, string>>,
  users: ReadonlySet<string>
): OwnershipUpdate[] {
  const merged = new Map<string, { collection: string; id: string; levels: Map<string, number> }>();
  for (const group of groups) {
    const to = choices[group.oldId];
    if (to === undefined || !users.has(to)) {
      continue;
    }
    for (const doc of group.docs) {
      const key = `${doc.collection}.${doc.id}`;
      const entry = merged.get(key) ?? {
        collection: doc.collection,
        id: doc.id,
        levels: new Map<string, number>(),
      };
      const level = Math.max(
        ...[doc.ownership[group.oldId], doc.ownership[to], entry.levels.get(to)].map((n) => n ?? 0)
      );
      entry.levels.set(to, level);
      merged.set(key, entry);
    }
  }
  return [...merged.values()].map(({ collection, id, levels }) => ({
    collection,
    update: {
      _id: id,
      ...Object.fromEntries([...levels].map(([user, level]) => [`ownership.${user}`, level])),
    },
  }));
}
