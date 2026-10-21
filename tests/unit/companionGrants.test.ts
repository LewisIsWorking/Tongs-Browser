import { describe, expect, it } from 'vitest';

import { companionGrants } from '../../src/welcome/sheetLimit.js';
import { countedSheetsFor } from '../../src/welcome/welcomeDocuments.js';
import type { WelcomeGame } from '../../src/welcome/welcomeDocuments.js';

/**
 * What companions add to a player's sheet limit. 2026-10-21.
 *
 * Lewis: "the sheet limit per person should be 2, if you have a companion class or a familiar class then
 * +1 for each instance of that". The same rule as ComeOnOverUno's companion-grants.mjs (COO PR #3258).
 */
const flags =
  (values: Record<string, unknown>) =>
  (scope: string, key: string): unknown =>
    scope === 'tongs-browser' ? values[key] : undefined;

const sheet = (uuid: string, extra: Record<string, unknown> = {}) => ({
  id: uuid.slice(6),
  uuid,
  name: uuid,
  type: 'character',
  isOwner: true,
  ownership: { u1: 3 },
  getFlag: flags({}),
  ...extra,
});

const companion = sheet('Actor.FAM', {
  getFlag: flags({ companionOf: 'Actor.A', companionKind: 'animal-companion' }),
});
const handMade = sheet('Actor.HAND', {
  ancestry: {
    _stats: { compendiumSource: 'Compendium.pf2e-animal-companions.AC-Eidolons.Item.x' },
  },
});

function gameWith(actors: unknown[], isGM = true): WelcomeGame {
  return {
    user: { id: isGM ? 'gm' : 'u1', isGM },
    users: { contents: [{ id: 'u1', name: 'Lai', role: 1 }] },
    actors: { contents: actors },
  } as unknown as WelcomeGame;
}

const withItems = (uuid: string, ...slugs: string[]) =>
  sheet(uuid, { items: { contents: slugs.map((slug) => ({ system: { slug } })) } });

describe('what companions add (2026-10-21, as ComeOnOverUno companion-grants.mjs)', () => {
  it('adds one per companion kind a sheet grants, summed over sheets', () => {
    const witchDruid = withItems('Actor.A', 'familiar-witch', 'animal-companion', 'fireball');
    const summoner = withItems('Actor.B', 'summoner-dedication');
    expect(companionGrants([witchDruid, summoner])).toBe(3);
    expect(companionGrants([])).toBe(0);
  });

  it('counts a kind once, however many of its items a sheet has', () => {
    expect(
      companionGrants([withItems('Actor.A', 'animal-companion', 'animal-companion-ranger')])
    ).toBe(1);
  });

  it('counts a Pet only without a familiar', () => {
    expect(companionGrants([withItems('Actor.A', 'pet')])).toBe(1);
    expect(companionGrants([withItems('Actor.A', 'familiar', 'pet')])).toBe(1);
  });

  it('never counts upgrades or feats that change a companion already there', () => {
    expect(
      companionGrants([
        withItems(
          'Actor.A',
          'mature-animal-companion',
          'enhanced-familiar',
          'undead-companion',
          'psychopomp-familiar'
        ),
      ])
    ).toBe(0);
  });

  it("reads PF2e's item slug, or the item's own, and skips items with none", () => {
    const loose = sheet('Actor.A', {
      items: { contents: [{ slug: 'eidolon' }, { system: {} }, { system: { slug: null } }] },
    });
    expect(companionGrants([loose, sheet('Actor.B')])).toBe(1);
  });

  it("is read from the player's counted sheets, leaving companions out", () => {
    const game = gameWith([
      withItems('Actor.A', 'familiar'),
      companion,
      handMade,
      withItems('Actor.O', 'eidolon'),
    ]);
    const sheets = countedSheetsFor(game, 'u1');
    expect(sheets.map((each) => each.uuid)).toEqual(['Actor.A', 'Actor.O']);
    expect(companionGrants(sheets)).toBe(2);
    expect(countedSheetsFor(gameWith([withItems('Actor.A', 'familiar')], false), 'u1')).toEqual([]);
  });
});
