import { describe, expect, it } from 'vitest';

import { automationRole } from '../../src/automation/automationRole.js';
import { readStrikeAttack, readStrikeDamage } from '../../src/automation/strikeFacts.js';
import type { StrikeMessage } from '../../src/automation/strikeFacts.js';
import { checkTarget } from '../../src/automation/targetCheck.js';
import type { TargetState } from '../../src/automation/targetCheck.js';

/**
 * Who acts, what a strike's cards say, and whether a target still qualifies. Written 2026-09-14.
 *
 * ⚠️ The card fixtures are the measured Reinforced Stock attack and damage from pf2e 8.5.0.
 */
describe('which browser acts', () => {
  const world = (
    me: { id: string; role: number },
    activeGM: { id: string; role: number } | null
  ) => ({
    game: { user: me, users: { activeGM } },
  });

  it('the active full GM acts', () => {
    expect(automationRole(world({ id: 'gm', role: 4 }, { id: 'gm', role: 4 }))).toBe('act');
  });

  it('everyone else leaves it to them', () => {
    expect(automationRole(world({ id: 'p', role: 1 }, { id: 'gm', role: 4 }))).toBe('leave');
    expect(automationRole(world({ id: 'gm2', role: 4 }, { id: 'gm', role: 4 }))).toBe('leave');
  });

  /** ⛔ Decided: an Assistant GM never applies; while only an Assistant is on, hits queue. */
  it('queues when no GM, or only an Assistant GM, is connected', () => {
    expect(automationRole(world({ id: 'p', role: 1 }, null))).toBe('queue');
    expect(automationRole(world({ id: 'a', role: 3 }, { id: 'a', role: 3 }))).toBe('queue');
    expect(automationRole({})).toBe('queue');
  });
});

describe("reading a strike's cards", () => {
  const TARGET = { token: 'Scene.S.Token.X' };
  const ORIGIN = { uuid: 'Actor.A.Item.W' };
  const attackCard: StrikeMessage = {
    id: 'a1',
    timestamp: 1,
    speaker: { actor: 'A' },
    flags: {
      pf2e: {
        context: { type: 'attack-roll', outcome: 'success', target: TARGET },
        origin: ORIGIN,
      },
    },
  };
  const damageCard: StrikeMessage = {
    id: 'd1',
    timestamp: 2,
    isDamageRoll: true,
    speaker: { actor: 'A' },
    author: { id: 'player' },
    flags: {
      pf2e: {
        context: { type: 'damage-roll', sourceType: 'attack', outcome: 'success', target: TARGET },
        origin: ORIGIN,
        strike: { index: 1 },
      },
    },
    rolls: [{ formula: '1d8 + 3 bludgeoning', total: 7, minimumValue: 4, maximumValue: 11 }],
  };

  it('reads the attack and the damage', () => {
    expect(readStrikeAttack(attackCard, 'pf2e')).toEqual({
      id: 'a1',
      timestamp: 1,
      actorId: 'A',
      itemUuid: 'Actor.A.Item.W',
      targetToken: 'Scene.S.Token.X',
      outcome: 'success',
    });
    expect(readStrikeDamage(damageCard, 'pf2e')).toMatchObject({
      authorId: 'player',
      strikeIndex: 1,
      formula: '1d8 + 3 bludgeoning',
      total: 7,
      min: 4,
      max: 11,
    });
  });

  it("reads the running system's namespace only", () => {
    expect(readStrikeAttack(attackCard, 'sf2e')).toBeNull();
    expect(readStrikeDamage(damageCard, 'sf2e')).toBeNull();
  });

  it('does not take one kind of card for the other', () => {
    expect(readStrikeAttack(damageCard, 'pf2e')).toBeNull();
    expect(readStrikeDamage(attackCard, 'pf2e')).toBeNull();
  });

  it('is not strike damage without a strike, a roll, or an attack as its source', () => {
    const flags = damageCard.flags?.['pf2e'] as Record<string, unknown>;
    expect(
      readStrikeDamage({ ...damageCard, flags: { pf2e: { ...flags, strike: null } } }, 'pf2e')
    ).toBeNull();
    expect(readStrikeDamage({ ...damageCard, rolls: [] }, 'pf2e')).toBeNull();
    expect(readStrikeDamage({ ...damageCard, speaker: {} }, 'pf2e')).toBeNull();
    const spell = { ...(flags['context'] as object), sourceType: 'save' };
    expect(
      readStrikeDamage({ ...damageCard, flags: { pf2e: { ...flags, context: spell } } }, 'pf2e')
    ).toBeNull();
  });

  it('reads no target and no author as null', () => {
    const flags = damageCard.flags?.['pf2e'] as Record<string, unknown>;
    const bare = { ...(flags['context'] as object), target: null, outcome: undefined };
    const facts = readStrikeDamage(
      { ...damageCard, author: null, flags: { pf2e: { ...flags, context: bare } } },
      'pf2e'
    );
    expect(facts?.targetToken).toBeNull();
    expect(facts?.outcome).toBeNull();
    expect(facts?.authorId).toBeNull();
  });
});

describe('whether the target still qualifies', () => {
  const fine: TargetState = {
    exists: true,
    hp: 20,
    inCombat: true,
    playerOwned: false,
  };
  const reason = (overrides: Partial<typeof fine>) => {
    const verdict = checkTarget({ ...fine, ...overrides });
    return verdict.kind === 'deck' ? verdict.reason : verdict.kind;
  };

  it('an enemy still standing in the fight', () => {
    expect(reason({})).toBe('ok');
  });

  it('sends gone, friendly, down and out-of-combat targets to the deck', () => {
    expect(reason({ exists: false })).toContain('no longer on the scene');
    expect(reason({ playerOwned: true })).toContain("player's creature");
    expect(reason({ hp: 0 })).toContain('no hit points');
    expect(reason({ hp: null })).toContain('no hit points');
    expect(reason({ inCombat: false })).toContain('not in a running combat');
  });
});
