import { describe, expect, it } from 'vitest';

import { buildApplyPorts } from '../../src/deck/buildApplyPorts.js';

/**
 * The real Foundry behind aiming PF2e at a target on any scene. Written 2026-09-15, when the deck stopped
 * selecting tokens; see `src/deck/aimAt.ts`. Split from buildApplyPorts.test.ts for the 200-line limit.
 */
const doc = {
  createElement: () => ({ dataset: {} as Record<string, string> }),
} as unknown as Document;

describe('finding the target token, on any scene', () => {
  const goblin = { name: 'goblin', actor: { name: 'Goblin' } };
  const lookup = (uuid: string) => (uuid === 'Scene.ELSEWHERE.Token.T1' ? goblin : null);

  /* ⛔ Since 2026-09-15 PF2e is aimed at the document, so the scene being viewed decides nothing. */
  it('finds a token on a scene nobody is viewing', () => {
    const ports = buildApplyPorts({ fromUuidSync: lookup }, doc);

    expect(ports.tokenFor('Scene.ELSEWHERE.Token.T1')).toBe(goblin);
  });

  it('finds nothing for a deleted token, a token with no actor, a non-token uuid, or a lookup that throws', () => {
    const noActor = buildApplyPorts({ fromUuidSync: () => ({ name: 'bare' }) }, doc);
    const throws = buildApplyPorts(
      {
        fromUuidSync: () => {
          throw new Error('bad uuid');
        },
      },
      doc
    );

    expect(
      buildApplyPorts({ fromUuidSync: lookup }, doc).tokenFor('Scene.S1.Token.gone')
    ).toBeNull();
    expect(noActor.tokenFor('Scene.S1.Token.T1')).toBeNull();
    expect(buildApplyPorts({ fromUuidSync: () => goblin }, doc).tokenFor('Actor.A1')).toBeNull();
    expect(throws.tokenFor('Scene.S1.Token.T1')).toBeNull();
  });
});

describe('aiming PF2e through the user', () => {
  it('aims through the user this browser is signed in as, and says when there is none', () => {
    const user = { getActiveTokens: (): readonly object[] => [] };
    const ports = buildApplyPorts({ game: { user } }, doc);
    let seen: readonly object[] = [];

    ports.aimAt([{ name: 'goblin' }], () => {
      seen = user.getActiveTokens();
    });

    expect(ports.canAim()).toBe(true);
    expect(seen).toEqual([{ name: 'goblin' }]);
    expect(buildApplyPorts({}, doc).canAim()).toBe(false);
    expect(() => {
      buildApplyPorts({}, doc).aimAt([], () => undefined);
    }).not.toThrow();
  });

  it("offers Triple only when PF2e's crit and fumble buttons are on", () => {
    const withButtons = (buttons: boolean) =>
      buildApplyPorts({ game: { pf2e: { settings: { critFumble: { buttons } } } } }, doc);

    expect(withButtons(true).offersTriple()).toBe(true);
    expect(withButtons(false).offersTriple()).toBe(false);
    expect(buildApplyPorts({}, doc).offersTriple()).toBe(false);
  });
});
