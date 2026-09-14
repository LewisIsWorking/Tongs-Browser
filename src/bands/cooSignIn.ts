import { MODULE_ID } from '../constants.js';
import type { CooClient } from './CooClient.js';

/**
 * Signing the GM's browser in to ComeOnOverUno, from Foundry's module settings. Added 2026-09-14.
 *
 * ⛔ THE PASSWORD IS HANDED STRAIGHT TO COO AND FORGOTTEN. Only the refresh token COO returns is kept,
 * and `CooClient` keeps it. The dialog is Foundry's own `DialogV2.input`, so nothing here renders a form.
 *
 * ⚠️ Foundry opens a settings menu with `new menu.type().render(true)`, so the menu is a class whose
 * `render` opens the dialog. `restricted` keeps it to GMs, the only users bands are for.
 */
const SIGN_IN_MENU = 'cooSignIn';

export interface SignInGlobals {
  readonly foundry?: {
    readonly applications?: {
      readonly api?: {
        readonly DialogV2?: { input?(options: object): Promise<unknown> };
      };
    };
  };
  readonly ui?: {
    readonly notifications?: { info?(message: string): unknown; warn?(message: string): unknown };
  };
}

export interface MenuSettings {
  registerMenu?(namespace: string, key: string, data: object): void;
}

const FORM = [
  '<label>ComeOnOverUno username <input name="username" type="text" autocomplete="username"></label>',
  '<label>Password <input name="password" type="password" autocomplete="current-password"></label>',
].join('');

/** Asks for the login, and says plainly whether it worked. */
export async function signIn(client: CooClient, globals: SignInGlobals): Promise<boolean> {
  const answer = (await globals.foundry?.applications?.api?.DialogV2?.input?.({
    window: { title: 'Sign in to ComeOnOverUno' },
    content: FORM,
    ok: { label: 'Sign in' },
  })) as { username?: unknown; password?: unknown } | null | undefined;
  const username = typeof answer?.username === 'string' ? answer.username.trim() : '';
  const password = typeof answer?.password === 'string' ? answer.password : '';
  if (username === '' || password === '') {
    return false;
  }
  const ok = await client.signIn(username, password).catch(() => false);
  if (ok) {
    globals.ui?.notifications?.info?.(
      'Signed in to ComeOnOverUno. Health bands can now be posted.'
    );
  } else {
    globals.ui?.notifications?.warn?.('ComeOnOverUno did not accept that sign-in.');
  }
  return ok;
}

export function registerSignInMenu(
  settings: MenuSettings,
  client: CooClient,
  globals: SignInGlobals
): void {
  class SignInMenu {
    public render(): this {
      void signIn(client, globals);
      return this;
    }
  }
  settings.registerMenu?.(MODULE_ID, SIGN_IN_MENU, {
    name: 'ComeOnOverUno sign-in',
    label: 'Sign in',
    hint: 'Sign this browser in to ComeOnOverUno so it can post health bands. Only the GM needs to.',
    icon: 'fas fa-right-to-bracket',
    type: SignInMenu,
    restricted: true,
  });
}
