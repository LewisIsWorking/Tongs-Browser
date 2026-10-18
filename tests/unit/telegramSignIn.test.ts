import { describe, expect, it, vi } from 'vitest';

import type { CooClient } from '../../src/bands/CooClient.js';
import {
  CODE_FORM,
  registerTelegramSignInMenu,
  signInWithTelegram,
  TELEGRAM_BUSY,
  TELEGRAM_FAILED,
} from '../../src/bands/telegramSignIn.js';

/**
 * "Sign in with Telegram" from the module settings (2026-10-18): the username goes to COO, which DMs a pairing
 * code, and the code goes through the ordinary pairing sign-in.
 */
describe('signing in with Telegram', () => {
  const client = (status: number | Error, paired = true) =>
    ({
      tell: vi.fn(() =>
        status instanceof Error ? Promise.reject(status) : Promise.resolve(status)
      ),
      pair: vi.fn(() => Promise.resolve(paired)),
    }) as unknown as CooClient & { tell: ReturnType<typeof vi.fn>; pair: ReturnType<typeof vi.fn> };
  const globals = (...answers: unknown[]) => {
    const input = vi.fn<(options: { content: string }) => Promise<unknown>>();
    for (const a of answers) input.mockResolvedValueOnce(a);
    return {
      foundry: { applications: { api: { DialogV2: { input } } } },
      ui: { notifications: { info: vi.fn(), warn: vi.fn() } },
    };
  };

  it('asks COO to message a code, then signs in with the code typed back', async () => {
    const c = client(204);
    const g = globals({ username: ' lewis ' }, { code: 'ABCD-EFGH' });

    expect(await signInWithTelegram(c, g)).toBe(true);

    expect(c.tell).toHaveBeenCalledWith('/api/auth/pair/telegram', {
      username: 'lewis',
      deviceName: 'Tongs Browser',
    });
    expect(c.pair).toHaveBeenCalledWith('ABCD-EFGH');
    expect(g.foundry.applications.api.DialogV2.input.mock.calls[1]?.[0].content).toBe(CODE_FORM);
    expect(g.ui.notifications.info).toHaveBeenCalled();
  });

  it('sends nothing when the username dialog is closed or blank', async () => {
    for (const answer of [null, {}, { username: '  ' }, { username: 7 }]) {
      const c = client(204);
      expect(await signInWithTelegram(c, globals(answer))).toBe(false);
      expect(c.tell).not.toHaveBeenCalled();
    }
    expect(await signInWithTelegram(client(204), {})).toBe(false);
  });

  it('says why when COO would not send, and never asks for a code', async () => {
    for (const [status, message] of [
      [429, TELEGRAM_BUSY],
      [404, TELEGRAM_FAILED],
      [502, TELEGRAM_FAILED],
      [new Error('offline'), TELEGRAM_FAILED],
    ] as const) {
      const c = client(status);
      const g = globals({ username: 'lewis' }, { code: 'ABCD-EFGH' });
      expect(await signInWithTelegram(c, g)).toBe(false);
      expect(g.ui.notifications.warn).toHaveBeenCalledWith(message);
      expect(c.pair).not.toHaveBeenCalled();
    }
  });

  it('registers a GM-only menu whose render starts the Telegram sign-in', () => {
    const registerMenu = vi.fn();
    class ApplicationV2 {
      public render(): unknown {
        return undefined;
      }
    }
    const g = globals(null);
    const withApp = {
      ...g,
      foundry: { applications: { api: { ...g.foundry.applications.api, ApplicationV2 } } },
    };
    expect(registerTelegramSignInMenu({ registerMenu }, client(204), withApp)).toBe(true);
    const data = registerMenu.mock.calls[0]?.[2] as {
      label: string;
      restricted: boolean;
      type: new () => { render(): unknown };
    };
    expect(data.label).toBe('Sign in with Telegram');
    expect(data.restricted).toBe(true);
    new data.type().render();
    expect(g.foundry.applications.api.DialogV2.input).toHaveBeenCalled();
    expect(registerTelegramSignInMenu({}, client(204), withApp)).toBe(false);
  });
});
