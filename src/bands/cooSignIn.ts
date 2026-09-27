import type { CooClient } from './CooClient.js';
import { registerGmMenu } from './settingsMenu.js';
import type { MenuGlobals, MenuSettings } from './settingsMenu.js';

/**
 * Signing the GM's browser in to ComeOnOverUno, from Foundry's module settings. Added 2026-09-14.
 *
 * ⛔ THE PASSWORD IS HANDED STRAIGHT TO COO AND FORGOTTEN. Only the refresh token COO returns is kept,
 * and `CooClient` keeps it. The dialog is Foundry's own `DialogV2.input`, so nothing here renders a form.
 *
 * The menu itself, and why it must be an ApplicationV2, is `settingsMenu.ts`.
 */
const SIGN_IN_MENU = 'cooSignIn';

/*
 * ⚠️ WHAT THE SIGN-IN IS FOR, said in full. It used to promise only health bands, because that was all it
 * did; by 2026-09-22 the same sign-in also drove encounter sync and the world-swap heartbeat, and the
 * heartbeat matters most - without it ComeOnOverUno thinks no GM is present and a player's Play closes this
 * world without asking. A GM reading "health bands" had no reason to think signing in protected the table.
 */
export const SIGNED_IN =
  'Signed in to ComeOnOverUno. Health bands, encounter sync and world-swap requests now work in this browser.';
export const SIGN_IN_HINT =
  'Sign this browser in to ComeOnOverUno for health bands, encounter sync and world-swap requests. ' +
  'Without it, a player pressing Play for another campaign closes this world without asking. Only the GM needs to.';

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
    globals.ui?.notifications?.info?.(SIGNED_IN);
  } else {
    globals.ui?.notifications?.warn?.('ComeOnOverUno did not accept that sign-in.');
  }
  return ok;
}

/** True when the menu was registered. False, never a throw, when Foundry refuses or cannot. */
export function registerSignInMenu(
  settings: MenuSettings,
  client: CooClient,
  globals: SignInGlobals & MenuGlobals
): boolean {
  return registerGmMenu(
    settings,
    globals,
    {
      key: SIGN_IN_MENU,
      name: 'ComeOnOverUno sign-in',
      label: 'Sign in',
      hint: SIGN_IN_HINT,
      icon: 'fas fa-right-to-bracket',
    },
    async () => signIn(client, globals)
  );
}
