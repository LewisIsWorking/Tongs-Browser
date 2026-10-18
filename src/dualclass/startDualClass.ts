import { logger } from '../core/Logger.js';
import { readGmPresence } from '../foundry/DesignatedGm.js';
import type { GmGame } from '../foundry/DesignatedGm.js';
import { dualClassImage } from './buildDualClass.js';
import type { ChoiceGame } from './classChoices.js';
import { answerDualClass, dualClassSheet, pendingDualClasses } from './dualClassDocuments.js';
import type { DualClassGame } from './dualClassDocuments.js';
import { DualClassRequests } from './DualClassRequests.js';
import type { LoadedClass } from './DualClassRequests.js';
import { startDualClassPlayer } from './startDualClassPlayer.js';
import type { DualClassPlayerGlobals } from './startDualClassPlayer.js';

/**
 * Dual class, started at `ready`: the GM's side in a GM's browser, the player's side in a player's.
 * Added 2026-10-12; the GM's rules are in `DualClassRequests.ts`, the player's in `startDualClassPlayer`.
 *
 * ⚠️ No setting. Lewis wants it in every world, and a player who never presses "Dual class…" never
 *    writes a request, so the GM's side wakes on `updateUser`, finds nothing, and does nothing.
 */
export type DualClassGlobals = DualClassPlayerGlobals & {
  readonly game?: DualClassGame &
    GmGame &
    ChoiceGame & {
      readonly packs?: { get(key: string): object | undefined };
    };
  readonly fromUuid?: (uuid: string) => Promise<unknown>;
};

interface ClassDocument {
  readonly type?: string;
  readonly name?: string;
  toObject?(): { readonly system?: unknown };
}

export function startDualClass(
  hooks: { on(name: string, fn: () => unknown): unknown },
  globals: DualClassGlobals,
  doc: Document
): void {
  startDualClassPlayer(hooks, globals, doc);
  const game = (): DualClassGlobals['game'] => globals.game;
  if (game()?.user?.isGM !== true) {
    return;
  }
  const requests = new DualClassRequests({
    isDesignatedGm: () => readGmPresence({ getGame: game }).isMe,
    pending: () => pendingDualClasses(game()),
    sheet: (actorId, userId) => dualClassSheet(game(), actorId, userId),
    packPresent: (key) => game()?.packs?.get(key) !== undefined,
    loadClass: async (uuid) => loadClass(globals, uuid),
    img: () => dualClassImage(game()?.system?.id ?? 'pf2e'),
    answer: async (userId, result) => answerDualClass(game(), userId, result),
    tellGm: (text) => globals.ui?.notifications?.info?.(text),
  });
  const run = (): void => {
    requests.serve().catch((error: unknown) => {
      logger.warn(
        `Dual class requests failed: ${error instanceof Error ? error.message : String(error)}`
      );
    });
  };
  hooks.on('updateUser', run);
  hooks.on('userConnected', run);
  run();
}

/** ⚠️ The SOURCE (`toObject`), not the prepared document, so derived values never become the item's. */
async function loadClass(globals: DualClassGlobals, uuid: string): Promise<LoadedClass | null> {
  const found = (await globals.fromUuid?.(uuid)) as ClassDocument | null | undefined;
  const system = found?.toObject?.().system;
  if (typeof found?.name !== 'string' || typeof system !== 'object' || system === null) {
    return null;
  }
  return { type: found.type ?? '', name: found.name, system: system as LoadedClass['system'] };
}
