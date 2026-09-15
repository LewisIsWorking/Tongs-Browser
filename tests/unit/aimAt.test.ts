import { describe, expect, it } from 'vitest';

import { aimAt } from '../../src/deck/aimAt.js';
import type { AimableUser } from '../../src/deck/aimAt.js';

/**
 * Aiming PF2e's own controls at chosen token documents for one synchronous click. Written 2026-09-15.
 *
 * ⚠️ The user is a class instance whose `getActiveTokens` lives on its PROTOTYPE, as `UserPF2e`'s does,
 * so these prove the method is shadowed and then uncovered rather than overwritten.
 */
class FakeUser implements AimableUser {
  public controlled: object[] = [{ name: 'the GM own pick' }];

  public getActiveTokens(): readonly object[] {
    return this.controlled;
  }
}

describe('aiming at tokens for one click', () => {
  const goblin = { name: 'goblin on another scene' };

  it('has the click read exactly the chosen tokens, then gives PF2e its own method back', () => {
    const user = new FakeUser();
    let seen: readonly object[] = [];

    aimAt(user, [goblin], () => {
      seen = user.getActiveTokens();
    });

    expect(seen).toEqual([goblin]);
    expect(Object.prototype.hasOwnProperty.call(user, 'getActiveTokens')).toBe(false);
    expect(user.getActiveTokens()).toEqual([{ name: 'the GM own pick' }]);
  });

  /** ⛔ Left in place, every later apply the GM made by hand would land on the automation's last target. */
  it('takes the aim off even when the click throws', () => {
    const user = new FakeUser();

    expect(() => {
      aimAt(user, [goblin], () => {
        throw new Error('PF2e broke');
      });
    }).toThrow('PF2e broke');
    expect(user.getActiveTokens()).toEqual([{ name: 'the GM own pick' }]);
  });

  it('gives back an own method a user already had, and copes with none at all', () => {
    const own = () => [{ name: 'own' }];
    const user: AimableUser = { getActiveTokens: own };
    aimAt(user, [goblin], () => undefined);
    expect(user.getActiveTokens).toBe(own);

    const bare: AimableUser = {};
    aimAt(bare, [goblin], () => {
      expect(bare.getActiveTokens?.()).toEqual([goblin]);
    });
    expect('getActiveTokens' in bare).toBe(false);
  });

  /* ⛔ Measured off-scene: a save found no roller token, so its card could not be tied to the creature. */
  it("has each target's own actor answer with its token document, and only for documents", () => {
    class FakeActor {
      public readonly name = 'xorn';
      public getActiveTokens(
        this: FakeActor,
        _linked?: boolean,
        document?: boolean
      ): readonly unknown[] {
        return [`canvas token of ${this.name}, documents=${String(document)}`];
      }
    }
    const actor = new FakeActor();
    const token = { name: 'xorn token on scene B', actor };
    const twin = { name: 'second token of the same linked actor', actor };
    let asked: unknown[] = [];

    aimAt(new FakeUser(), [token, twin], () => {
      asked = [actor.getActiveTokens(true, true), actor.getActiveTokens(true)];
    });

    expect(asked).toEqual([[twin], ['canvas token of xorn, documents=undefined']]);
    expect(Object.prototype.hasOwnProperty.call(actor, 'getActiveTokens')).toBe(false);
    expect(actor.getActiveTokens(true, true)).toEqual(['canvas token of xorn, documents=true']);
    expect(() => {
      aimAt(new FakeUser(), [{ actor: null }, { actor: {} }, {}], () => undefined);
    }).not.toThrow();
  });
});
