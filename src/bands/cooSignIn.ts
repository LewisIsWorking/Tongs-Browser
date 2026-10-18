import type { CooClient } from './CooClient.js';
import { registerGmMenu } from './settingsMenu.js';
import type { MenuGlobals, MenuSettings } from './settingsMenu.js';

/**
 * Signing the GM's browser in to ComeOnOverUno, from Foundry's module settings. Added 2026-09-14.
 *
 * ⛔ THE CODE IS HANDED STRAIGHT TO COO AND FORGOTTEN. Only the refresh token COO returns is kept,
 * and `CooClient` keeps it. Since 2026-10-14 it is a one-time pairing code from the COO app, not a password:
 * COO accounts no longer have passwords. The dialog is Foundry's own `DialogV2.input`, so nothing here renders a form.
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
  '<p>In the ComeOnOverUno app, open Settings and press <b>Get a pairing code</b> under Pair a device.</p>',
  '<label>Pairing code <input name="code" type="text" autocomplete="one-time-code" placeholder="ABCD-EFGH"></label>',
].join('');

/** Asks for a pairing code, and says plainly whether it worked. `form` says where the code comes from. */
export async function signIn(
  client: CooClient,
  globals: SignInGlobals,
  form: string = FORM
): Promise<boolean> {
  const answer = (await globals.foundry?.applications?.api?.DialogV2?.input?.({
    window: { title: 'Sign in to ComeOnOverUno' },
    content: form,
    ok: { label: 'Sign in' },
  })) as { code?: unknown } | null | undefined;
  const code = typeof answer?.code === 'string' ? answer.code.trim() : '';
  if (code === '') {
    return false;
  }
  const ok = await client.pair(code).catch(() => false);
  if (ok) {
    globals.ui?.notifications?.info?.(SIGNED_IN);
  } else {
    globals.ui?.notifications?.warn?.(
      'ComeOnOverUno did not accept that code. Codes last 5 minutes and work once; ask for a new one.'
    );
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
