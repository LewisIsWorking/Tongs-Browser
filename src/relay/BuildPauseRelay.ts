import { MODULE_ID } from '../constants.js';
import { PauseRelay } from './PauseRelay.js';
import type { SocketLike } from './PauseRelay.js';
import type { FoundryActions } from '../foundry/FoundryActions.js';
import type { Logger } from '../core/Logger.js';

/**
 * The real Foundry behind the pause relay. Extracted from `ModuleParts` 2026-09-03.
 *
 * ⚠️ Moved out when a SECOND relay arrived, so both are built the same way and `ModuleParts` reads as
 * a list of parts rather than as the place two relays happen to be configured. The composition
 * factory was also at 196 of its 200 lines, so the next relay could not have gone in beside it.
 *
 * ⚠️ Every global is resolved LAZILY on each call rather than captured here. The socket, the user
 * list and who counts as the designated GM all change during a session, and a GM disconnecting
 * mid-game is exactly when a relay has to still pick the right client.
 */
export function buildPauseRelay(actions: FoundryActions, logger: Logger): PauseRelay {
  return new PauseRelay({
    get socket(): SocketLike | null {
      return (globalThis as { game?: { socket?: SocketLike } }).game?.socket ?? null;
    },
    channel: `module.${MODULE_ID}`,
    isDesignatedGm: () => actions.isDesignatedGm(),
    applyPause: (pause: boolean) => {
      actions.applyPause(pause);
    },
    getPaused: () => (globalThis as { game?: { paused?: boolean } }).game?.paused === true,
    logger,
  });
}
