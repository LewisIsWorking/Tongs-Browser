import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import { readGmPresence } from '../foundry/DesignatedGm.js';
import type { GmGame } from '../foundry/DesignatedGm.js';
import {
  PENDING_LEVEL_FLAG,
  levelNotes,
  readPendingLevel,
  setsPendingLevel,
} from './pendingLevel.js';
import type { Flagged } from './pendingLevel.js';

/**
 * A pending level, applied by one GM's browser. Added 2026-11-14; the rules are in pendingLevel.ts.
 *
 * For each actor carrying `flags.tongs-browser.pendingLevel`, in turn: the level is updated (so PF2e's
 * own grant and ChoiceSet flow runs, as when a GM types it on the sheet), then HP is set to the new
 * maximum, then the flag is unset, then the GM is told.
 *
 * ⚠️ ONE AT A TIME, through one queue for the whole browser. Each level change can open ChoiceSet
 *    prompts and waits for them, so two at once would pile prompts up. The `ready` sweep, an
 *    `updateActor` and the API call all wait their turn in the same queue.
 * ⚠️ Only the designated GM (`game.users.activeGM`) acts by itself, so two GMs online level once. The
 *    API call is a GM's own request, so any GM may make it.
 * ⚠️ The flag is unset whatever happens: refused, failed, or done. A flag left behind would be applied
 *    again at the next launch, on top of whatever the GM fixed by hand.
 * ⚠️ In `check:documents`' BOUNDARY: it enumerates `game.actors`, GM only, failing closed, and shows the
 *    GM nothing but the names of actors it changed.
 */
interface LevelActor extends Flagged {
  readonly name?: string | null;
  readonly system?: {
    readonly details?: { readonly level?: { readonly value?: unknown } };
    readonly attributes?: { readonly hp?: { readonly max?: unknown } };
  };
  update(data: object): Promise<unknown>;
  unsetFlag(scope: string, key: string): Promise<unknown>;
}

export interface LevelGlobals {
  readonly game?: GmGame & {
    readonly user?: { readonly id?: string; readonly isGM?: boolean };
    readonly actors?: { readonly contents: readonly LevelActor[] };
  };
  readonly ui?: {
    readonly notifications?: { info?(message: string): unknown; warn?(message: string): unknown };
  };
}

let queue: Promise<unknown> = Promise.resolve();

/** Runs `job` after every job queued before it has finished, whether that one worked or not. */
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job);
  queue = next.catch(() => undefined);
  return next;
}

async function clearFlag(actor: LevelActor, name: string): Promise<void> {
  try {
    await actor.unsetFlag(MODULE_ID, PENDING_LEVEL_FLAG);
  } catch (error) {
    logger.warn(`Could not clear the pending level on ${name}: ${String(error)}`);
  }
}

/** Applies one actor's pending level. Resolves to whether its level was changed. */
async function applyOne(actor: LevelActor, globals: LevelGlobals): Promise<boolean> {
  const pending = readPendingLevel(actor);
  if (pending.kind === 'none') {
    return false;
  }
  const name = actor.name ?? 'an actor';
  const notes = globals.ui?.notifications;
  if (pending.kind === 'invalid') {
    await clearFlag(actor, name);
    notes?.warn?.(levelNotes.invalid(name, pending.value));
    return false;
  }
  const before = actor.system?.details?.level?.value;
  let failure: { readonly error: unknown } | null = null;
  try {
    await actor.update({ 'system.details.level.value': pending.level });
    /* Read AFTER the update: PF2e has prepared the actor again, so this is the new level's maximum. */
    const max = actor.system?.attributes?.hp?.max;
    if (typeof max === 'number') {
      await actor.update({ 'system.attributes.hp.value': max });
    }
  } catch (error) {
    failure = { error };
  }
  await clearFlag(actor, name);
  if (failure !== null) {
    notes?.warn?.(levelNotes.failed(name, pending.level, failure.error));
    return false;
  }
  if (before === pending.level) {
    notes?.warn?.(levelNotes.unchanged(name, pending.level));
  } else {
    notes?.info?.(levelNotes.levelled(name, pending.level));
  }
  return true;
}

/**
 * Applies every actor's pending level, one at a time. Resolves to how many were levelled, or null in a
 * browser that is not a GM's.
 */
export async function applyPendingLevels(globals: LevelGlobals): Promise<number | null> {
  /* ⛔ GM only, failing closed: it changes actors the player may not own. */
  if (globals.game?.user?.isGM !== true) {
    return null;
  }
  return enqueue(async () => {
    let levelled = 0;
    for (const actor of globals.game?.actors?.contents ?? []) {
      if (await applyOne(actor, globals)) {
        levelled += 1;
      }
    }
    return levelled;
  });
}

/** What the module's `api` gains: `applyPendingLevels()`, for a GM's macro. */
export function pendingLevelApi(globals: object): {
  applyPendingLevels(): Promise<number | null>;
} {
  return { applyPendingLevels: async () => applyPendingLevels(globals) };
}

function warnFailed(error: unknown): void {
  logger.warn(`Pending levels failed: ${error instanceof Error ? error.message : String(error)}`);
}

/** At `ready`, and whenever the flag is set on a running world, the designated GM applies it. */
export function startPendingLevels(hooks: FoundryHooks, globals: LevelGlobals): void {
  const isDesignatedGm = (): boolean => readGmPresence({ getGame: () => globals.game }).isMe;
  hooks.on('updateActor', (actor: unknown, changes: unknown) => {
    if (setsPendingLevel(changes) && isDesignatedGm()) {
      enqueue(async () => applyOne(actor as LevelActor, globals)).catch(warnFailed);
    }
  });
  if (isDesignatedGm()) {
    applyPendingLevels(globals).catch(warnFailed);
  }
}
