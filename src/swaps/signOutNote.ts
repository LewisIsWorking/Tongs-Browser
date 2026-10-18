/**
 * A one-time note to the COO portal that a sign-out was on purpose. Added 2026-10-18 (Lewis: "yes do it", on
 * "Can we make it auto-enter the running world?").
 *
 * The portal (foundry.cooserver.duckdns.org/) shares this origin, so it reads the same sessionStorage. When Foundry
 * bounces a player there it presses Play by itself, unless it finds this note: an idle GM signed out by the AFK
 * guard, or anyone pressing Foundry's Log Out, should land on the campaign list, not straight back in the world.
 * A restart or world switch never calls logOut, so no note is left and the player goes back in.
 */
export const SIGN_OUT_NOTE = 'coo.signedOut';
export type SignOutReason = 'afk' | 'out';

export interface NoteStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Leaves the note, keeping an earlier one (the AFK guard's 'afk' survives the logOut it then calls). */
export function noteSignOut(store: NoteStore | undefined, reason: SignOutReason): void {
  try {
    if (store?.getItem(SIGN_OUT_NOTE) === null) {
      store.setItem(SIGN_OUT_NOTE, reason);
    }
  } catch {
    // Storage blocked: the portal then counts down before going in, and "Stay here" still stops it.
  }
}

/** Foundry's game, as far as logging out goes. A property, so wrapping it keeps `this` explicit. */
export interface LogOutGame {
  logOut?: (...args: unknown[]) => unknown;
}

/** Makes every game.logOut (Foundry's Log Out button included) leave an 'out' note first. */
export function markLogOuts(game: LogOutGame | undefined, store: NoteStore | undefined): void {
  const original = game?.logOut;
  if (game === undefined || original === undefined) {
    return;
  }
  game.logOut = (...args: unknown[]): unknown => {
    noteSignOut(store, 'out');
    return original.apply(game, args);
  };
}
