import { describe, expect, it } from 'vitest';

import { describeGroup, orphanGroups, ownershipUpdates } from '../../src/owners/orphanOwners.js';
import type { OwnedDoc } from '../../src/owners/orphanOwners.js';

/**
 * Finding what a removed Forge-era user owned, and handing it on. Written 2026-09-29, when Antoine's homebrew
 * and Ryo's characters turned out to be owned by user ids that no longer existed.
 */
const OLD_RYO = 'ForgeRyo00000001';
const OLD_ANT = 'ForgeAntoine0001';
const NEW_RYO = 'CooRyo0000000001';
const GM = 'GameMaster000001';
const users = new Set([NEW_RYO, GM]);

const doc = (
  collection: string,
  id: string,
  name: string,
  ownership: Record<string, number>,
  type = ''
): OwnedDoc => ({
  collection,
  id,
  name,
  type,
  ownership,
});

const kitt = doc('Actor', 'a1', 'Kitt', { default: 0, [OLD_RYO]: 3, [GM]: 3 }, 'character');
const zels = doc('Actor', 'a2', 'Zels', { [OLD_RYO]: 3 }, 'character');
const sword = doc('Item', 'i1', 'Homebrew Sword', { [OLD_ANT]: 3 });
const notes = doc('JournalEntry', 'j1', 'Shared notes', { [OLD_ANT]: 2, [OLD_RYO]: 1 });

describe('finding orphaned owners', () => {
  it('groups documents by an owner id that is no longer a user, most-owning first', () => {
    const groups = orphanGroups([kitt, zels, sword, notes], users);
    expect(groups.map((g) => g.oldId)).toEqual([OLD_RYO, OLD_ANT]);
    expect(groups[0]?.docs.map((d) => d.name)).toEqual(['Kitt', 'Zels', 'Shared notes']);
  });

  it('ignores current users, "default", no access, and anything not shaped like a user id', () => {
    const noise = doc('Actor', 'x', 'Noise', {
      default: 3,
      [GM]: 3,
      [NEW_RYO]: 3,
      [OLD_ANT]: 0,
      short: 3,
    });
    expect(orphanGroups([noise], users)).toEqual([]);
  });

  it('describes a group by its characters first, then the rest, capped', () => {
    const [ryo] = orphanGroups([notes, kitt, zels], users);
    expect(describeGroup(ryo!)).toBe('Kitt, Zels, Shared notes');
    expect(describeGroup(ryo!, 1)).toBe('Kitt and 2 more');
  });
});

describe('handing them on', () => {
  it("gives the chosen user the old user's level and never touches the old id", () => {
    const groups = orphanGroups([kitt, notes], users);
    expect(ownershipUpdates(groups, { [OLD_RYO]: NEW_RYO }, users)).toEqual([
      { collection: 'Actor', update: { _id: 'a1', [`ownership.${NEW_RYO}`]: 3 } },
      { collection: 'JournalEntry', update: { _id: 'j1', [`ownership.${NEW_RYO}`]: 1 } },
    ]);
  });

  it('keeps a higher level the new user already has, and merges two old users given to one person', () => {
    const shared = doc('Item', 'i2', 'Shared', { [OLD_RYO]: 1, [OLD_ANT]: 3, [NEW_RYO]: 2 });
    const groups = orphanGroups([shared], users);
    expect(ownershipUpdates(groups, { [OLD_RYO]: NEW_RYO, [OLD_ANT]: NEW_RYO }, users)).toEqual([
      { collection: 'Item', update: { _id: 'i2', [`ownership.${NEW_RYO}`]: 3 } },
    ]);
  });

  it('leaves alone anything unchosen, or chosen as someone who is not a user here', () => {
    const groups = orphanGroups([kitt, sword], users);
    expect(ownershipUpdates(groups, { [OLD_ANT]: 'NotAUserHere0001' }, users)).toEqual([]);
  });
});
