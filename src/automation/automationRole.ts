/**
 * What THIS browser does with a player's hit: act on it, leave it to the GM's browser, or queue it.
 * Added 2026-09-14.
 *
 * Decided with Lewis: act if a GM is connected, queue if not, and only a FULL Gamemaster acts. An
 * Assistant GM's browser never applies; while only an Assistant is on, hits stay queued.
 *
 * ⚠️ Built on Foundry's `game.users.activeGM`, documented for "workflows which occur on all clients,
 * but where only one user should take action". It prefers a non-assistant GM, so when it returns an
 * Assistant, no full Gamemaster is connected. Measured 2026-09-14: `CONST.USER_ROLES.GAMEMASTER` is 4,
 * and one GM user cannot be joined from two browsers at once, so "this browser is the active GM" names
 * exactly one browser.
 */
export const GAMEMASTER_ROLE = 4;

export type AutomationRole =
  /** This browser is the active full GM: validate and apply now. */
  | 'act'
  /** A full GM is connected elsewhere, and that browser will act. */
  | 'leave'
  /** No full GM is connected: the author queues their own hit for later. */
  | 'queue';

interface UserLike {
  readonly id?: string;
  readonly role?: number;
}

export interface RoleGlobals {
  readonly game?: {
    readonly user?: UserLike;
    readonly users?: { readonly activeGM?: UserLike | null };
  };
}

export function automationRole(globals: RoleGlobals): AutomationRole {
  const active = globals.game?.users?.activeGM;
  if (active?.role !== GAMEMASTER_ROLE) {
    return 'queue';
  }
  const me = globals.game?.user;
  return me?.id !== undefined && me.id === active.id && me.role === GAMEMASTER_ROLE
    ? 'act'
    : 'leave';
}
