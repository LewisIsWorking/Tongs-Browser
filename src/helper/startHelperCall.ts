import { MODULE_ID } from '../constants.js';
import { PENDING_FLAG } from '../automation/AutoApply.js';
import { automationRole } from '../automation/automationRole.js';
import type { RoleGlobals } from '../automation/automationRole.js';
import { REQUEST_FLAG } from '../welcome/sheetRequest.js';
import { waitingWork } from './waitingWork.js';
import type { WaitingGame } from './waitingWork.js';

/**
 * Asking ComeOnOverUno for its helper GM when this browser queues work with no GM online. Added 2026-10-10.
 *
 * ⭐ The helper is a GM account COO signs in from a hidden browser on the server. It opens the world, Tongs
 *    in that browser does the queued work exactly as a GM's would, and COO posts what was done. So a new
 *    player gets their sheet without Lewis being on the world.
 *
 * ⚠️ The call carries only the world id, and COO needs nothing else: whatever it is told, the helper acts
 *    on the flags it finds in the world itself, so a forged or repeated call can at most start one visit.
 *    COO limits how often that happens.
 *
 * ⚠️ Only THIS browser's own writes count (Foundry passes the writing user's id to every hook), so ten
 *    players watching one queued card make one call, not ten.
 */
export const WAITING_PATH = '/api/pathwars/foundry/tongs-waiting';
/** One call a minute at most: a burst of queued hits needs one visit, not one each. */
export const CALL_GAP_MS = 60_000;

export interface HelperCallPorts {
  readonly myId: () => string | undefined;
  readonly queues: () => boolean;
  readonly worldId: () => string | undefined;
  readonly tell: (path: string, body: object) => Promise<unknown>;
  readonly now: () => number;
}

interface FlagHolder {
  readonly flags?: Readonly<Record<string, unknown>>;
}

const ours = (changes: FlagHolder | undefined): Record<string, unknown> | undefined =>
  changes?.flags?.[MODULE_ID] as Record<string, unknown> | undefined;

/** Whether a write by this browser put work in a GM's queue: a sheet request, or a pending card. */
export function queuedSomething(changes: FlagHolder | undefined): boolean {
  const flags = ours(changes);
  return (
    flags !== undefined && ((flags[REQUEST_FLAG] ?? null) !== null || flags[PENDING_FLAG] === true)
  );
}

export class HelperCall {
  private last = -Infinity;

  public constructor(private readonly ports: HelperCallPorts) {}

  /** A hook saw a write: call COO if it was ours, it queued work, and nobody is here to do it. */
  public async onWrite(changes: FlagHolder | undefined, userId: unknown): Promise<void> {
    if (userId !== this.ports.myId() || !queuedSomething(changes) || !this.ports.queues()) {
      return;
    }
    const world = this.ports.worldId();
    if (world === undefined || this.ports.now() - this.last < CALL_GAP_MS) {
      return;
    }
    this.last = this.ports.now();
    await this.ports.tell(WAITING_PATH, { world });
  }
}

export interface HelperGlobals {
  readonly game?: RoleGlobals['game'] & WaitingGame & { readonly world?: { readonly id?: string } };
}

interface HooksLike {
  on(name: string, fn: (...args: never[]) => unknown): unknown;
}

interface ModuleEntry {
  helper?: unknown;
}

export function startHelperCall(
  hooks: HooksLike,
  globals: HelperGlobals,
  tell: HelperCallPorts['tell'],
  entry: ModuleEntry | undefined
): HelperCall {
  const call = new HelperCall({
    myId: () => globals.game?.user?.id,
    queues: () => automationRole(globals) === 'queue',
    worldId: () => globals.game?.world?.id,
    tell,
    now: () => Date.now(),
  });
  const write = (changes: FlagHolder | undefined, userId: unknown): void => {
    void call.onWrite(changes, userId).catch(() => undefined);
  };
  /* Foundry's hooks: update(document, changes, options, userId) and create(document, options, userId). */
  hooks.on('updateUser', (_user: never, changes: never, _options: never, userId: never) => {
    write(changes, userId);
  });
  hooks.on('updateChatMessage', (_message: never, changes: never, _options: never, id: never) => {
    write(changes, id);
  });
  hooks.on('createChatMessage', (message: never, _options: never, userId: never) => {
    write(message, userId);
  });
  /* What COO's helper reads: `game.modules.get('tongs-browser').helper.waiting()`. */
  if (entry !== undefined) {
    entry.helper = { waiting: () => waitingWork(globals.game) };
  }
  return call;
}
