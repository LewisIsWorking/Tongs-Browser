import { describe, expect, it } from 'vitest';

import { judgeCreatedSheet, newActorIds } from '../../scripts/sheets/createVerdict.ts';

/**
 * Judging a sheet the create button really made. Written 2026-09-12.
 *
 * ⚠️ These prove the half of the live creation check that decides pass or fail, and the half that
 * decides what gets DELETED. The second matters more: a cleanup that picked the wrong actor would
 * remove a real player's sheet from a real world.
 */
const expected = { type: 'character', ownerLevel: 3 };
const good = { type: 'character', folder: null, inParty: true, ownerLevel: 3 };

describe('finding the actor to clean up', () => {
  it('returns only actors that did not exist before the press', () => {
    expect(newActorIds(['a', 'b'], ['a', 'b', 'c'])).toEqual(['c']);
  });

  /**
   * ⛔ THE SAFETY PROPERTY. Nothing present before the press can ever be returned, however the lists
   * are ordered, so no pre-existing sheet can be selected for deletion. Matching by name could not
   * promise this: any real character sharing the default name would qualify.
   */
  it('never returns an actor that existed before, whatever the order', () => {
    expect(newActorIds(['c', 'a', 'b'], ['b', 'c', 'a'])).toEqual([]);
  });

  it('returns every new actor when a press made more than one', () => {
    expect(newActorIds(['a'], ['a', 'x', 'y'])).toEqual(['x', 'y']);
  });

  /** ⚠️ An actor deleted during the press is not "new", and must not appear. */
  it('ignores actors that disappeared rather than appeared', () => {
    expect(newActorIds(['a', 'gone'], ['a'])).toEqual([]);
  });
});

describe('a sheet made correctly', () => {
  it('passes every verdict', () => {
    const verdicts = judgeCreatedSheet(1, good, expected);

    expect(verdicts.every((verdict) => verdict.passed)).toBe(true);
    expect(verdicts).toHaveLength(5);
  });
});

describe('a sheet made wrongly', () => {
  /**
   * ⚠️ "Exactly one" is its own claim. A press that made two would still yield facts for the first,
   * and every other verdict could pass on those.
   */
  it('fails when one tap made more than one sheet', () => {
    const verdicts = judgeCreatedSheet(2, good, expected);

    expect(verdicts.find((verdict) => verdict.name.includes('exactly one'))?.passed).toBe(false);
  });

  it('fails, and stops, when nothing was made', () => {
    const verdicts = judgeCreatedSheet(0, null, expected);

    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]?.passed).toBe(false);
  });

  it('fails when the sheet never joined the party', () => {
    const verdicts = judgeCreatedSheet(1, { ...good, inParty: false }, expected);

    expect(verdicts.find((verdict) => verdict.name.includes('joined'))?.passed).toBe(false);
  });

  /**
   * ⛔ The PF2e behaviour read from source on 2026-09-10 and never yet watched: joining a party sets
   * the actor's folder to null. A sheet still in a folder means that stopped being true.
   */
  it('fails when joining the party left the sheet in a folder', () => {
    const verdicts = judgeCreatedSheet(1, { ...good, folder: 'folder123' }, expected);
    const folder = verdicts.find((verdict) => verdict.name.includes('folder'));

    expect(folder?.passed).toBe(false);
    expect(folder?.detail).toContain('folder123');
  });

  /**
   * ⛔ THE PASS THAT PROVED NOTHING. A new actor has no folder whether or not it ever joined a party,
   * so "folder is null" on a sheet that never joined says nothing about `addMembers`. The first live
   * run printed exactly that PASS beside "NOT in the party". It must refuse to pass what it did not see.
   */
  it('will not pass the folder check for a sheet that never joined the party', () => {
    const verdicts = judgeCreatedSheet(1, { ...good, inParty: false, folder: null }, expected);
    const folder = verdicts.find((verdict) => verdict.name.includes('folder'));

    expect(folder?.passed).toBe(false);
    expect(folder?.detail).toContain('cannot judge');
  });

  it('fails when the owner cannot open it', () => {
    const verdicts = judgeCreatedSheet(1, { ...good, ownerLevel: 2 }, expected);

    expect(verdicts.find((verdict) => verdict.name.includes('owner'))?.passed).toBe(false);
  });

  it('fails when an owner level is missing rather than wrong', () => {
    const verdicts = judgeCreatedSheet(1, { ...good, ownerLevel: undefined }, expected);

    expect(verdicts.find((verdict) => verdict.name.includes('owner'))?.passed).toBe(false);
  });

  it('fails when the wrong actor type was made', () => {
    const verdicts = judgeCreatedSheet(1, { ...good, type: 'npc' }, expected);

    expect(verdicts.find((verdict) => verdict.name.includes('is a'))?.passed).toBe(false);
  });
});
