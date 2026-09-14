import { describe, expect, it } from 'vitest';

import type { SaveResultFacts, SpellDamageFacts } from '../../src/automation/spellDamageFacts.js';
import { validateSpellDamage } from '../../src/automation/validateSpellDamage.js';
import type {
  CastWithTargets,
  SpellDamageHistory,
  SpellDamageRule,
} from '../../src/automation/validateSpellDamage.js';
import { ATTACK_WINDOW_MS } from '../../src/automation/validateStrike.js';

/**
 * Whether basic-save spell damage applies without the GM, and how. Written 2026-09-14, against the
 * measured rank 5 Vampiric Feast: 10d6 void, minimum 10, maximum 60.
 */
const SPELL = 'Actor.C.Item.Feast';
const [X1, X2, X3, X4] = [
  'Scene.S.Token.X1',
  'Scene.S.Token.X2',
  'Scene.S.Token.X3',
  'Scene.S.Token.X4',
];
const RULE: SpellDamageRule = { formula: '10d6 void', basic: true };

const cast = (overrides: Partial<CastWithTargets> = {}): CastWithTargets => ({
  id: 'c1',
  timestamp: 1_000,
  actorId: 'C',
  spellUuid: SPELL,
  castRank: 5,
  targets: [X1, X2],
  ...overrides,
});
const damage = (overrides: Partial<SpellDamageFacts> = {}): SpellDamageFacts => ({
  id: 'd1',
  timestamp: 2_000,
  actorId: 'C',
  authorId: 'p',
  spellUuid: SPELL,
  castRank: 5,
  formula: '10d6 void',
  total: 24,
  min: 10,
  max: 60,
  ...overrides,
});
const save = (tokenUuid: string, outcome: string, timestamp = 1_500): SaveResultFacts => ({
  id: `s-${tokenUuid}-${String(timestamp)}`,
  timestamp,
  spellUuid: SPELL,
  tokenUuid,
  outcome,
});
const history = (overrides: Partial<SpellDamageHistory> = {}): SpellDamageHistory => ({
  casts: [cast()],
  damages: [],
  saves: [save(X1, 'success'), save(X2, 'failure')],
  ...overrides,
});

describe('applying basic-save spell damage', () => {
  it('groups every target by its degree of success, a critical success taking nothing', () => {
    const targets = [X1, X2, X3, X4];
    const verdict = validateSpellDamage(
      damage(),
      history({
        casts: [cast({ targets })],
        saves: [
          save(X1, 'success'),
          save(X2, 'failure'),
          save(X3, 'criticalFailure'),
          save(X4, 'criticalSuccess'),
          save(X2, 'success', 900),
          { ...save(X1, 'failure'), spellUuid: 'Actor.C.Item.Other' },
        ],
      }),
      RULE
    );

    expect(verdict).toEqual({
      kind: 'valid',
      targets,
      groups: [
        { optionId: 'half', targetTokenUuids: [X1] },
        { optionId: 'full', targetTokenUuids: [X2] },
        { optionId: 'double', targetTokenUuids: [X3] },
      ],
    });
  });

  it('waits while any target has not rolled, counting only saves before the next cast', () => {
    const verdict = validateSpellDamage(
      damage({ timestamp: 5_000 }),
      history({
        casts: [cast({ id: 'c0', timestamp: 500 }), cast(), cast({ id: 'c2', timestamp: 6_000 })],
        saves: [save(X1, 'success'), save(X2, 'failure', 7_000)],
      }),
      RULE
    );

    expect(verdict).toEqual({
      kind: 'wait',
      targets: [X1, X2],
      reason: "waiting for 1 of the spell's targets to roll their save",
    });
  });

  it('sends to the deck, saying why, anything that does not check out', () => {
    const cases: [SpellDamageFacts, SpellDamageHistory, SpellDamageRule | null, string][] = [
      [damage({ actorId: 'Other' }), history(), RULE, 'no cast of that spell'],
      [
        damage({ timestamp: 1_000 + ATTACK_WINDOW_MS + 1 }),
        history(),
        RULE,
        'no cast of that spell',
      ],
      [
        damage({ castRank: 3 }),
        history(),
        RULE,
        'rolled at rank 3 but the spell was cast at rank 5',
      ],
      [
        damage(),
        history({ damages: [damage({ id: 'd0', timestamp: 1_800 })] }),
        RULE,
        'already rolled',
      ],
      [damage(), history(), null, 'could not be worked out'],
      [damage(), history(), { formula: null, basic: true }, 'could not be worked out'],
      [damage(), history(), { ...RULE, basic: false }, 'not a basic save'],
      [damage(), history(), { ...RULE, formula: '6d6 void' }, "is not the spell's 6d6 void"],
      [damage({ total: 61 }), history(), RULE, 'a total of 61 is not possible'],
      [damage({ total: 9 }), history(), RULE, 'a total of 9 is not possible'],
      [damage(), history({ casts: [cast({ targets: [] })] }), RULE, 'no targets'],
      [
        damage(),
        history({ saves: [save(X1, 'success'), save(X1, 'failure', 1_600)] }),
        RULE,
        'more than one save',
      ],
      [
        damage(),
        history({ saves: [save(X1, 'constructor'), save(X2, 'failure')] }),
        RULE,
        'not a degree of success',
      ],
    ];
    for (const [facts, past, rule, reason] of cases) {
      const verdict = validateSpellDamage(facts, past, rule);
      expect(verdict.kind === 'deck' && verdict.reason).toContain(reason);
    }
  });

  it('does not count the damage card itself as damage already rolled', () => {
    expect(validateSpellDamage(damage(), history({ damages: [damage()] }), RULE).kind).toBe(
      'valid'
    );
  });
});
