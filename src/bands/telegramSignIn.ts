import type { CooClient } from './CooClient.js';
import { PAIRED_DEVICE_NAME } from './CooClient.js';
import { signIn } from './cooSignIn.js';
import type { SignInGlobals } from './cooSignIn.js';
import { registerGmMenu } from './settingsMenu.js';
import type { MenuGlobals, MenuSettings } from './settingsMenu.js';

/**
 * "Sign in with Telegram", from Foundry's module settings. Added 2026-10-18 at Lewis's request: "Tongs should
 * get a telegram sign in button".
 *
 * The GM types their ComeOnOverUno username, COO's Path Wars bot privately messages the Telegram linked to that
 * account a pairing code (`POST api/auth/pair/telegram`), and the code goes through the ordinary pairing sign-in
 * (`signIn` in `cooSignIn.ts`). Telegram's own login widget is tied to one website and cannot run in a Foundry
 * game, so the code travels by message instead.
 *
 * ⛔ COO answers 204 whatever it finds, so this cannot say whether the username exists or has Telegram linked;
 * the second dialog says so instead of promising a message.
 */
const TELEGRAM_MENU = 'cooTelegramSignIn';

export const TELEGRAM_HINT =
  'Sign this browser in with Telegram: the Path Wars bot messages a code to the Telegram linked to your ' +
  'ComeOnOverUno account. Only the GM needs to.';
export const TELEGRAM_BUSY = 'Too many sign-in codes asked for. Wait a few minutes and try again.';
export const TELEGRAM_FAILED =
  'ComeOnOverUno could not send a Telegram code just now. Try again, or use Sign in with a code from the app.';

const USERNAME_FORM =
  '<p>The Path Wars bot will message a sign-in code to the Telegram linked to this account.</p>' +
  '<label>ComeOnOverUno username <input name="username" type="text" autocomplete="username"></label>';

export const CODE_FORM = [
  '<p>Check your Telegram for a message from the Path Wars bot. If none arrives, that username has no linked ',
  'Telegram, or you have not pressed Start on the bot.</p>',
  '<label>Code from Telegram <input name="code" type="text" autocomplete="one-time-code" placeholder="ABCD-EFGH"></label>',
].join('');

/** Asks for the username, has COO send the code, then signs in with it. */
export async function signInWithTelegram(
  client: CooClient,
  globals: SignInGlobals
): Promise<boolean> {
  const answer = (await globals.foundry?.applications?.api?.DialogV2?.input?.({
    window: { title: 'Sign in with Telegram' },
    content: USERNAME_FORM,
    ok: { label: 'Send me a code' },
  })) as { username?: unknown } | null | undefined;
  const username = typeof answer?.username === 'string' ? answer.username.trim() : '';
  if (username === '') {
    return false;
  }
  const status = await client
    .tell('/api/auth/pair/telegram', { username, deviceName: PAIRED_DEVICE_NAME })
    .catch(() => 0);
  if (status !== 204) {
    globals.ui?.notifications?.warn?.(status === 429 ? TELEGRAM_BUSY : TELEGRAM_FAILED);
    return false;
  }
  return signIn(client, globals, CODE_FORM);
}

/** True when the menu was registered. False, never a throw, when Foundry refuses or cannot. */
export function registerTelegramSignInMenu(
  settings: MenuSettings,
  client: CooClient,
  globals: SignInGlobals & MenuGlobals
): boolean {
  return registerGmMenu(
    settings,
    globals,
    {
      key: TELEGRAM_MENU,
      name: 'ComeOnOverUno sign-in with Telegram',
      label: 'Sign in with Telegram',
      hint: TELEGRAM_HINT,
      icon: 'fab fa-telegram',
    },
    async () => signInWithTelegram(client, globals)
  );
}
