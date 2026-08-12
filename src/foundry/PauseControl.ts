/**
 * Pausing the world from a phone. Extracted from TongsBrowser 2026-08-12.
 *
 * ⚠️ The hard part is not the toggle, it is WHO is allowed to broadcast it, and that is not obvious.
 * Foundry's `Game#togglePause` only emits the socket message
 *
 *     if ( options.broadcast && game.user.isGM )
 *
 * so a player calling it toggles their own client and nobody else's. The check is on the EMIT path,
 * not on permissions, which is why granting a player ownership of a macro does not help: an ordinary
 * script macro run by a player still only touches that player's client. Core Foundry has no
 * execute-as-GM either, verified against 14.365 where `executeAsGM`, `execute-as` and `asGM` appear
 * nowhere in client or common. That is a module feature.
 *
 * So letting players pause needs a GM side relay, and this module is the pieces of that arrangement
 * that can be reasoned about without a socket.
 */

export interface GameAccess {
  readonly getGame: () => FoundryGame | undefined;
}

export interface FoundryGame {
  readonly users?: { readonly activeGM?: { readonly id?: string } | null };
  readonly user?: { readonly id?: string; readonly isGM?: boolean };
  readonly macros?: {
    getName?: (name: string) => { canExecute?: boolean; execute?: () => unknown } | null;
  };
  togglePause?: (pause?: boolean, options?: { broadcast?: boolean }) => boolean;
}

/**
 * Whether this client is the ONE GM that should act on a relayed request.
 *
 * ⚠️ `game.users.activeGM` is Foundry's own designated user: it picks the same single GM on every
 * client, deterministically. Using "am I a GM" instead would have every connected GM answer the same
 * request, flipping the pause state once per GM and landing wherever the race ended. With two GMs
 * online that is a button that does nothing half the time, which is worse than one that never works.
 *
 * The fallback to plain `isGM` covers older builds with no `activeGM`, where it is still correct for
 * the overwhelmingly common case of a single GM.
 */
export function isDesignatedGm(access: GameAccess): boolean {
  const game = access.getGame();
  if (game === undefined) {
    return false;
  }

  const designated = game.users?.activeGM ?? null;
  if (designated?.id !== undefined && game.user?.id !== undefined) {
    return designated.id === game.user.id;
  }

  return game.user?.isGM === true;
}

/**
 * The authoritative toggle. Only ever reached on the designated GM's client.
 *
 * `broadcast` is what tells every other client, and Foundry only honours it from a GM, which is the
 * whole reason this must not be called anywhere else.
 */
export function applyPause(access: GameAccess, pause: boolean): void {
  const game = access.getGame();
  game?.togglePause?.(pause, { broadcast: true });
}

/** What the pause button should do: run the world's own macro, or ask a GM through the relay. */
export type PauseAction =
  | { readonly kind: 'runMacro'; readonly execute: () => unknown }
  | { readonly kind: 'relay' }
  | { readonly kind: 'nothing' };

/**
 * Decide how to pause.
 *
 * An explicitly authored macro wins, because a GM who wrote one meant it to be used, and keeping the
 * behaviour in the world's hands rather than hard coded here is what was asked for.
 *
 * It is worth being straight that the macro path only helps a PLAYER if the macro itself reaches a GM
 * somehow, which core Foundry cannot do. The relay is what actually makes the button work for
 * everyone, and it is the fallback rather than the first choice only because a hand written macro is
 * a deliberate instruction from whoever runs the world.
 */
export function decidePauseAction(access: GameAccess, macroName: string): PauseAction {
  const game = access.getGame();
  if (game === undefined) {
    return { kind: 'nothing' };
  }

  const macro = game.macros?.getName?.(macroName) ?? null;
  if (macro?.execute !== undefined && macro.canExecute !== false) {
    const execute = macro.execute;
    return { kind: 'runMacro', execute: () => execute() };
  }

  return { kind: 'relay' };
}
