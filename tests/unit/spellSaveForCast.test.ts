import { describe, expect, it } from 'vitest';

import { PENDING_FLAG } from '../../src/automation/AutoApply.js';
import type { SaveResultFacts, SpellDamageFacts } from '../../src/automation/spellDamageFacts.js';
import { readSaveResult } from '../../src/automation/spellDamageFacts.js';
import { tagSaveWithCast } from '../../src/automation/startSpellSaves.js';
import type { CastWithTargets } from '../../src/automation/validateSpellDamage.js';
import { validateSpellDamage } from '../../src/automation/validateSpellDamage.js';
import { castCard, harness, X1 } from './support/spellSavesWorld.js';

/**
 * Each save Tongs rolls belongs to ONE cast. Written 2026-10-07 from C04: Nadya cast Daze at Kreski three
 * times while no GM was connected; when Lewis came back all three saves landed after the last cast, and
 * the one damage roll (the third cast's) was applied as the FIRST cast's success, so Kreski took 1 instead
 * of the 0 his critical success on the third save earned.
 */
const DAZE = 'Actor.N.Item.Daze';
const RULE = { formula: '1d6 mental', basic: true };
const cast = (id: string, timestamp: number): CastWithTargets => ({
  id,
  timestamp,
  actorId: 'N',
  spellUuid: DAZE,
  castRank: 1,
  targets: [X1],
});
const damage: SpellDamageFacts = {
  id: 'd',
  timestamp: 1_900,
  actorId: 'N',
  authorId: 'p',
  spellUuid: DAZE,
  castRank: 1,
  formula: '1d6 mental',
  total: 2,
  min: 1,
  max: 6,
};
const save = (castId: string, outcome: string, timestamp: number): SaveResultFacts => ({
  id: `s-${castId}`,
  timestamp,
  spellUuid: DAZE,
  tokenUuid: X1,
  outcome,
  castId,
});
const casts = [cast('c1', 1_000), cast('c2', 1_500), cast('c3', 1_800)];

describe('a save names its cast', () => {
  it("pairs the damage with ITS cast's save, never an earlier cast's save that landed later", () => {
    const early = [save('c1', 'success', 90_000), save('c2', 'success', 90_001)];
    expect(validateSpellDamage(damage, { casts, damages: [], saves: early }, RULE).kind).toBe(
      'wait'
    );

    const all = [...early, save('c3', 'criticalSuccess', 90_002)];
    expect(validateSpellDamage(damage, { casts, damages: [], saves: all }, RULE)).toEqual({
      kind: 'valid',
      targets: [X1],
      groups: [],
    });
  });

  it('reads the cast from the save card, and none from a save Tongs did not roll', () => {
    const card = (flags: Record<string, unknown>) => ({
      id: 's',
      timestamp: 5,
      flags: {
        pf2e: {
          context: { type: 'saving-throw', outcome: 'success', target: { token: X1 } },
          origin: { uuid: DAZE },
        },
        ...flags,
      },
    });
    expect(readSaveResult(card({ 'tongs-browser': { forCast: 'c3' } }), 'pf2e')?.castId).toBe('c3');
    expect(readSaveResult(card({}), 'pf2e')).not.toHaveProperty('castId');
  });

  it('tags a save this GM is rolling, and leaves every other card alone', () => {
    const globals = { game: { system: { id: 'pf2e' }, user: { id: 'gm' } } };
    const tagged: object[] = [];
    const creating = (type: string, token: string | null = X1) => ({
      id: 'new',
      timestamp: 1,
      flags: { pf2e: { context: { type, target: token === null ? null : { token } } } },
      updateSource: (changes: object) => tagged.push(changes),
    });
    const castFor = (token: string) => (token === X1 ? 'c3' : null);

    tagSaveWithCast(creating('saving-throw'), 'gm', globals, castFor);
    tagSaveWithCast(creating('saving-throw'), 'player', globals, castFor);
    tagSaveWithCast(creating('saving-throw', 'Scene.S.Token.Other'), 'gm', globals, castFor);
    tagSaveWithCast(creating('damage-roll'), 'gm', globals, castFor);

    expect(tagged).toEqual([{ flags: { 'tongs-browser': { forCast: 'c3' } } }]);
  });
});

describe('rolling queued casts', () => {
  it('rolls one cast at a time even when catch-ups overlap, naming the cast being rolled', async () => {
    const cards = ['c1', 'c2', 'c3'].map((id) => ({ ...castCard([X1]), id }));
    const seen: string[] = [];
    let inFlight = 0;
    const { saves, flags } = harness({
      recentMessages: () => cards,
      rollSave: async (id) => {
        inFlight += 1;
        seen.push(`${id} in flight ${String(inFlight)} names ${String(saves.castRollingFor(X1))}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return { kind: 'rolled' };
      },
    });
    for (const card of cards) flags.set(`${card.id}.${PENDING_FLAG}`, true);

    await Promise.all([saves.catchUp(), saves.catchUp(), saves.catchUp()]);

    expect(seen).toEqual([
      'c1 in flight 1 names c1',
      'c2 in flight 1 names c2',
      'c3 in flight 1 names c3',
    ]);
    expect(saves.castRollingFor(X1)).toBeNull();
  });
});
