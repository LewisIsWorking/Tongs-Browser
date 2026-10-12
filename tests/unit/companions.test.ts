import { describe, expect, it } from 'vitest';

import { KIBWE, world } from './support/companionWorld.js';

/**
 * The GM's browser making companion sheets. 2026-10-12.
 *
 * Lewis: companion sheets are made automatically, owned by the player, in the party, and the GM is told.
 */
describe('making a companion', () => {
  it('makes the sheet, puts it in the party, marks the character, and tells the GM and player', async () => {
    const { companions, created, joined, marks, told, whispers } = world();
    await companions.serve();
    expect(created).toEqual(["Kibwe's Animal Companion:character"]);
    expect(joined).toEqual(['Actor.NEW1>Actor.P']);
    expect(marks).toEqual(['Actor.A=animal-companion']);
    expect(told).toEqual(["Tongs made Kibwe's Animal Companion for Lai."]);
    expect(whispers).toEqual([
      `u1: Tongs made Kibwe's Animal Companion for you, in your party. Open it and drag your animal companion's ancestry onto it from the "CC AC-Ancestries-and-Class" compendium (Companion Compendia).`,
    ]);
  });

  it('makes a familiar on the familiar sheet', async () => {
    const { companions, created } = world([{ ...KIBWE, slugs: ['familiar', 'pet'] }]);
    await companions.serve();
    expect(created).toEqual(["Kibwe's Familiar:familiar"]);
  });

  it('does nothing unless this browser is the designated GM', async () => {
    const { companions, created } = world([KIBWE], [], { isDesignatedGm: () => false });
    await companions.serve();
    expect(created).toEqual([]);
  });

  it('does nothing for a character in no party', async () => {
    const { companions, created, marks } = world([KIBWE], [], { partyOf: () => null });
    await companions.serve();
    expect(created).toEqual([]);
    expect(marks).toEqual([]);
  });
});

describe('made once', () => {
  it('never makes a kind the character is marked with, so a deleted companion stays deleted', async () => {
    const { companions, created, marks } = world([{ ...KIBWE, made: ['animal-companion'] }]);
    await companions.serve();
    expect(created).toEqual([]);
    expect(marks).toEqual([]);
  });

  it('only marks a companion that already exists for the character', async () => {
    const { companions, created, marks } = world(
      [{ ...KIBWE, slugs: ['familiar', 'eidolon'], made: [] }],
      [
        { of: 'Actor.A', ownerIds: [], kinds: ['familiar', 'pet'] },
        { of: null, ownerIds: ['u1'], kinds: ['eidolon'] },
        { of: 'Actor.Z', ownerIds: [], kinds: ['eidolon'] },
      ]
    );
    await companions.serve();
    expect(created).toEqual([]);
    expect(marks).toEqual(['Actor.A=familiar', 'Actor.A=familiar,eidolon']);
  });

  it('still makes one when a hand-made companion belongs to somebody else', async () => {
    const { companions, created } = world(
      [KIBWE],
      [{ of: null, ownerIds: ['u9'], kinds: ['animal-companion'] }]
    );
    await companions.serve();
    expect(created).toHaveLength(1);
  });

  it('runs one pass at a time; a call mid-pass becomes one more pass, not a duplicate', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const names: string[] = [];
    const slow = world([KIBWE], [], {
      create: async (companion) => {
        names.push(companion.name);
        await gate;
        return 'Actor.NEW';
      },
    });
    const first = slow.companions.serve();
    const second = slow.companions.serve();
    release();
    await Promise.all([first, second]);
    expect(names).toEqual(["Kibwe's Animal Companion"]);
    expect(slow.marks).toEqual(['Actor.A=animal-companion']);
  });
});
