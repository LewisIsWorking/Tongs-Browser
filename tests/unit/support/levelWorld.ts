import { vi } from 'vitest';

import { applyPendingLevels } from '../../../src/levels/startPendingLevels.js';
import type { LevelGlobals } from '../../../src/levels/startPendingLevels.js';

/**
 * A world for pending levels (src/levels), 2026-11-14. Every write and every notification goes into one
 * ordered log, so a test reads the order things happened in. HP max follows the level the way PF2e's
 * data preparation does (ten a level), so the HP written proves it was read after the level changed.
 */
export type Handler = (...args: unknown[]) => unknown;

export interface ActorOptions {
  readonly level?: number;
  /** The flag's value; leave it out for an actor with no pending level. */
  readonly pending?: unknown;
  /** Thrown by the level update, as PF2e or the server might. */
  readonly failWith?: unknown;
  /** The level update waits for this before it resolves, as it does while a ChoiceSet prompt is open. */
  readonly gate?: Promise<void>;
}

export function levelActor(log: string[], name: string, options: ActorOptions = {}) {
  const scope: Record<string, unknown> =
    'pending' in options ? { pendingLevel: options.pending } : {};
  const state = { level: options.level ?? 1 };
  return {
    name,
    flags: { 'tongs-browser': scope },
    system: {
      details: {
        level: {
          get value() {
            return state.level;
          },
        },
      },
      attributes: {
        hp: {
          get max() {
            return state.level * 10;
          },
        },
      },
    },
    update: vi.fn(async (data: Record<string, unknown>) => {
      log.push(`${name} ${JSON.stringify(data)}`);
      const level = data['system.details.level.value'];
      if (typeof level === 'number') {
        if ('failWith' in options) {
          throw options.failWith;
        }
        await options.gate;
        state.level = level;
      }
    }),
    unsetFlag: vi.fn(async (namespace: string, key: string) => {
      log.push(`${name} unset ${namespace}.${key}`);
      Reflect.deleteProperty(scope, key);
      return Promise.resolve();
    }),
  };
}

export interface LevelWorldOptions {
  readonly gm?: boolean;
  /** Whether this browser is Foundry's designated GM (`game.users.activeGM`). */
  readonly designated?: boolean;
  /** False for a world with no `ui`, so nothing can be told. */
  readonly ui?: boolean;
}

export function levelWorld(
  log: string[],
  actors: readonly object[],
  options: LevelWorldOptions = {}
) {
  const handlers = new Map<string, Handler>();
  const hooks = {
    on: vi.fn((name: string, handler: Handler) => {
      handlers.set(name, handler);
      return 1;
    }),
  } as unknown as FoundryHooks;
  const globals = {
    game: {
      user: { id: 'me', isGM: options.gm ?? true },
      users: { activeGM: { id: (options.designated ?? true) ? 'me' : 'other', name: 'GM' } },
      actors: { contents: actors },
    },
    ...(options.ui === false
      ? {}
      : {
          ui: {
            notifications: {
              info: (message: string) => log.push(`info: ${message}`),
              warn: (message: string) => log.push(`warn: ${message}`),
            },
          },
        }),
  } as unknown as LevelGlobals;
  return { handlers, hooks, globals };
}

/** Resolves once every job queued so far has finished: an empty sweep waits its turn behind them. */
export async function drained(): Promise<unknown> {
  return applyPendingLevels({ game: { user: { isGM: true } } });
}

/** A promise and the call that resolves it, for holding a level update open. */
export function gate(): { readonly promise: Promise<void>; readonly open: () => void } {
  let open = (): void => undefined;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}
