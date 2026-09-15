import { describe, expect, it, vi } from 'vitest';

import { registerSignInMenu, signIn } from '../../src/bands/cooSignIn.js';
import type { CooClient } from '../../src/bands/CooClient.js';

/**
 * Signing the GM's browser in to ComeOnOverUno from the module settings. Written 2026-09-14, split
 * from `bandsWiring.test.ts` at the 200 line limit when the menu became an ApplicationV2.
 */
describe('signing in', () => {
  const client = (ok: boolean | Error) =>
    ({
      signIn: vi.fn(() => (ok instanceof Error ? Promise.reject(ok) : Promise.resolve(ok))),
    }) as unknown as CooClient & { signIn: ReturnType<typeof vi.fn> };
  const globals = (answer: unknown) => ({
    foundry: {
      applications: { api: { DialogV2: { input: vi.fn(() => Promise.resolve(answer)) } } },
    },
    ui: { notifications: { info: vi.fn(), warn: vi.fn() } },
  });

  it('hands the login to COO once, and says whether it worked', async () => {
    const accepted = client(true);
    const g = globals({ username: ' lewis ', password: 'pw' });
    expect(await signIn(accepted, g)).toBe(true);
    expect(accepted.signIn).toHaveBeenCalledWith('lewis', 'pw');
    expect(g.ui.notifications.info).toHaveBeenCalled();

    for (const refusal of [client(false), client(new Error('offline'))]) {
      const r = globals({ username: 'lewis', password: 'pw' });
      expect(await signIn(refusal, r)).toBe(false);
      expect(r.ui.notifications.warn).toHaveBeenCalled();
    }
  });

  it('does nothing when the dialog is closed, half filled, or missing', async () => {
    for (const answer of [null, { username: 'lewis' }, { username: 7, password: 'pw' }]) {
      const c = client(true);
      expect(await signIn(c, globals(answer))).toBe(false);
      expect(c.signIn).not.toHaveBeenCalled();
    }
    expect(await signIn(client(true), {})).toBe(false);
  });

  it('registers a GM-only menu, an ApplicationV2, whose render opens the sign-in', () => {
    const registerMenu = vi.fn();
    class ApplicationV2 {
      public render(): unknown {
        return undefined;
      }
    }
    const g = {
      ...globals(null),
      foundry: {
        applications: { api: { ...globals(null).foundry.applications.api, ApplicationV2 } },
      },
    };
    expect(registerSignInMenu({ registerMenu }, client(true), g)).toBe(true);
    const data = registerMenu.mock.calls[0]?.[2] as {
      restricted: boolean;
      type: new () => { render(): unknown };
    };
    expect(data.restricted).toBe(true);
    const menu = new data.type();
    expect(menu).toBeInstanceOf(ApplicationV2);
    expect(menu.render()).toBe(menu);
    expect(g.foundry.applications.api.DialogV2.input).toHaveBeenCalled();
    expect(registerSignInMenu({}, client(true), g)).toBe(false);
    expect(registerSignInMenu({ registerMenu }, client(true), globals(null))).toBe(false);
    const refusing = () => {
      throw new Error('You must provide a menu type that is a FormApplication or ApplicationV2');
    };
    expect(registerSignInMenu({ registerMenu: refusing }, client(true), g)).toBe(false);
  });
});
