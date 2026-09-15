import { describe, expect, it } from 'vitest';

import { readSeenAttacker } from '../../src/bands/attackerView.js';
import type { AttackerGlobals } from '../../src/bands/attackerView.js';
import { imageUrl } from '../../src/bands/bandTokens.js';

/**
 * Whether the table may be told who dealt a hit, and with which picture. Written 2026-09-15; the rule was
 * decided with Lewis: the weapon and attacker are named when players can see the attacker.
 */
const FORGE = 'https://lewis.forge-vtt.com/game';

const world = (actor: object, tokens: object[] = [], nameVisibility = true): AttackerGlobals => ({
  location: { href: FORGE },
  fromUuidSync: (uuid: string) => (uuid === 'Actor.A' ? actor : null),
  game: {
    pf2e: { settings: { tokens: { nameVisibility } } },
    combats: {
      contents: [{ started: true, combatants: { contents: tokens.map((token) => ({ token })) } }],
    },
  },
});
const creature = (overrides: object = {}, conditions: string[] = []) => ({
  name: 'Sniper',
  img: 'systems/pf2e/icons/default.webp',
  hasPlayerOwner: false,
  hasCondition: (slug: string) => conditions.includes(slug),
  ...overrides,
});
const tokenOf = (actor: object, overrides: object = {}) => ({
  name: 'Sniper 2',
  hidden: false,
  playersCanSeeName: true,
  texture: { src: 'https://assets.forge-vtt.com/u/sniper.webp' },
  actor,
  ...overrides,
});

describe('an attacker the players can see', () => {
  it('is named as its token shows, with its token picture', () => {
    const actor = creature();
    expect(readSeenAttacker(world(actor, [tokenOf(actor)]), 'Actor.A')).toEqual({
      name: 'Sniper 2',
      image: 'https://assets.forge-vtt.com/u/sniper.webp',
    });
  });

  it("is a player's character acting from off the map, pictured by its prototype token", () => {
    const pc = creature({
      name: 'Changer',
      hasPlayerOwner: true,
      prototypeToken: { texture: { src: 'tokens/changer.webp' } },
    });
    expect(readSeenAttacker(world(pc), 'Actor.A')).toEqual({
      name: 'Changer',
      image: 'https://lewis.forge-vtt.com/tokens/changer.webp',
    });
  });

  it("is found through an unlinked token's own synthetic actor", () => {
    const actor = creature({ isToken: true });
    const own = tokenOf(actor, { name: 'Goblin 3' });
    expect(readSeenAttacker(world({ ...actor, token: own }), 'Actor.A')?.name).toBe('Goblin 3');
  });

  it("uses PF2e's name rule: a hidden name is fine when the world does not hide names", () => {
    const actor = creature();
    const token = tokenOf(actor, { playersCanSeeName: false });
    expect(readSeenAttacker(world(actor, [token], false), 'Actor.A')?.name).toBe('Sniper 2');
  });
});

describe('an attacker the players cannot see', () => {
  it('is hidden, undetected, nameless to players, or a monster on no map, or not there at all', () => {
    const hidden = creature();
    const unseen = creature({}, ['undetected']);
    const nameless = creature();
    const offMap = creature();
    expect(
      readSeenAttacker(world(hidden, [tokenOf(hidden, { hidden: true })]), 'Actor.A')
    ).toBeNull();
    expect(readSeenAttacker(world(unseen, [tokenOf(unseen)]), 'Actor.A')).toBeNull();
    expect(
      readSeenAttacker(
        world(nameless, [tokenOf(nameless, { playersCanSeeName: false })]),
        'Actor.A'
      )
    ).toBeNull();
    expect(readSeenAttacker(world(offMap), 'Actor.A')).toBeNull();
    expect(readSeenAttacker(world(creature()), 'Actor.Gone')).toBeNull();
    const throws: AttackerGlobals = {
      fromUuidSync: () => {
        throw new Error('bad uuid');
      },
    };
    expect(readSeenAttacker(throws, 'Actor.A')).toBeNull();
  });
});

describe('a picture the server can fetch', () => {
  it('is a full http or https URL, a game-relative path resolved, and nothing else', () => {
    const globals = { location: { href: FORGE } };
    expect(imageUrl('https://assets.forge-vtt.com/u/a.webp', globals)).toBe(
      'https://assets.forge-vtt.com/u/a.webp'
    );
    expect(imageUrl('icons/svg/mystery-man.svg', globals)).toBe(
      'https://lewis.forge-vtt.com/icons/svg/mystery-man.svg'
    );
    expect(imageUrl('data:image/png;base64,AAAA', globals)).toBeNull();
    expect(imageUrl('icons/x.webp', {})).toBeNull();
    expect(imageUrl('', globals)).toBeNull();
    expect(imageUrl(null, globals)).toBeNull();
  });
});
