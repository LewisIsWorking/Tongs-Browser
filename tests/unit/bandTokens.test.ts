import { describe, expect, it } from 'vitest';

import { combatSubjects, nameRules, subjectsForActor, viewOf } from '../../src/bands/bandTokens.js';
import type { ActorLike, BandGlobals, TokenDocLike } from '../../src/bands/bandTokens.js';

/**
 * Reading Foundry's tokens into bands, shaped like the measured pf2e 8.5.0 documents. Written
 * 2026-09-14.
 *
 * ⚠️ Fakes read `this`, so a version that calls a Foundry method detached from its object fails here.
 */
const actor = (overrides: Partial<ActorLike> = {}, conditions: string[] = []): ActorLike => ({
  isToken: false,
  hasPlayerOwner: false,
  alliance: 'opposition',
  system: {
    attributes: { hp: { value: 90, max: 115 } },
    traits: { value: ['earth', 'elemental'] },
  },
  hasCondition(this: ActorLike, slug: string) {
    return this.system !== undefined && conditions.includes(slug);
  },
  ...overrides,
});
const token = (
  id: string,
  owner: ActorLike | null = actor(),
  overrides: Partial<TokenDocLike> = {}
): TokenDocLike => ({
  id,
  uuid: `Scene.S.Token.${id}`,
  name: 'Xorn',
  hidden: false,
  playersCanSeeName: false,
  actor: owner,
  ...overrides,
});
const world = (
  combatTokens: TokenDocLike[],
  extra: Partial<NonNullable<BandGlobals['game']>> = {}
): BandGlobals => ({
  game: {
    combats: {
      contents: [
        {
          started: true,
          combatants: { contents: combatTokens.map((t) => ({ tokenId: t.id ?? '', token: t })) },
        },
      ],
    },
    pf2e: { settings: { tokens: { nameVisibility: true } } },
    i18n: {
      localize: (key: string) =>
        key === 'PF2E.Token.Mystified.TheCreature' ? 'The creature' : key,
    },
    ...extra,
  },
});

const without = (doc: TokenDocLike, key: keyof TokenDocLike): TokenDocLike =>
  Object.fromEntries(Object.entries(doc).filter(([name]) => name !== key));

describe('reading a token', () => {
  it('reads HP, traits, combat, allies and unseen conditions', () => {
    const xorn = token('X1');
    expect(viewOf(xorn, world([xorn]))).toEqual({
      tokenUuid: 'Scene.S.Token.X1',
      name: 'Xorn',
      hidden: false,
      playersCanSeeName: false,
      hp: 90,
      maxHp: 115,
      traits: ['earth', 'elemental'],
      ally: false,
      inCombat: true,
      unseen: false,
    });
    expect(
      viewOf(token('X2', actor({ alliance: 'party' }, ['undetected'])), world([]))
    ).toMatchObject({ ally: true, inCombat: false, unseen: true });
    expect(
      viewOf(
        token(
          'X3',
          actor({ hasPlayerOwner: true, system: { attributes: { hp: { value: 5, max: 9 } } } })
        ),
        {}
      )
    ).toMatchObject({ ally: true, traits: [] });
    expect(viewOf(without(token('X4'), 'name'), {})?.name).toBe('');
  });

  it('reads nothing from a token with no actor, no uuid or no HP', () => {
    expect(viewOf(token('X', null), {})).toBeNull();
    expect(viewOf(without(token('X'), 'uuid'), {})).toBeNull();
    expect(viewOf(token('X', actor({ system: {} })), {})).toBeNull();
    expect(
      viewOf(token('X', actor({ system: { attributes: { hp: { value: 3 } } } })), {})
    ).toBeNull();
  });

  it("takes PF2e's name rule and label, with a plain label when the system has none", () => {
    expect(nameRules(world([]))).toEqual({ nameVisibility: true, mystifiedName: 'The creature' });
    expect(nameRules({ game: { i18n: { localize: (key: string) => key } } })).toEqual({
      nameVisibility: false,
      mystifiedName: 'The creature',
    });
    expect(nameRules({}).mystifiedName).toBe('The creature');
  });
});

describe('which tokens a change concerns', () => {
  it("is the synthetic actor's own token, or every token of a linked actor", () => {
    const one = token('U1');
    const synthetic = actor({ isToken: true, token: one });
    const x1 = token('L1');
    const x2 = token('L2');
    const linked: ActorLike = {
      ...actor(),
      getActiveTokens(this: ActorLike, isLinked: boolean, asDocuments: boolean) {
        return this.system !== undefined && isLinked && asDocuments ? [x1, x2] : [];
      },
    };
    const globals = world([one, x1]);

    expect(subjectsForActor(synthetic, globals).map((s) => s?.name)).toEqual(['The creature']);
    expect(subjectsForActor(linked, globals).map((s) => s?.tokenUuid ?? null)).toEqual([
      'Scene.S.Token.L1',
      null,
    ]);
    expect(subjectsForActor(actor({ isToken: true, token: null }), globals)).toEqual([]);
    expect(subjectsForActor(null, globals)).toEqual([]);
    expect(subjectsForActor(actor(), globals)).toEqual([]);
  });

  it('seeds from every combatant with a token, in every encounter', () => {
    const xorn = token('C1');
    const globals: BandGlobals = {
      game: {
        combats: {
          contents: [
            { combatants: { contents: [{ tokenId: 'C1', token: xorn }] } },
            {
              combatants: {
                contents: [
                  { tokenId: 'gone', token: null },
                  { tokenId: 'E', token: token('E', null) },
                ],
              },
            },
          ],
        },
      },
    };

    expect(combatSubjects(globals).map((s) => s?.segments ?? null)).toEqual([8, null, null]);
    expect(combatSubjects({ game: { combats: null } })).toEqual([]);
  });
});
