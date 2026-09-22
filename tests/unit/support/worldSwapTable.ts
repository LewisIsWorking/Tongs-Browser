import { expect, vi } from 'vitest';

import type { CooClient, CooResponse } from '../../../src/bands/CooClient.js';
import { startWorldSwaps } from '../../../src/swaps/startWorldSwaps.js';
import type { SwapGlobals, SwapTimers } from '../../../src/swaps/startWorldSwaps.js';

/**
 * A browser with a GM in a world, a fake ComeOnOverUno, and a timer the test fires by hand.
 * Written 2026-09-20.
 *
 * ⚠️ One beat is several awaits deep (presence, its json, the dialog, the decision), so `tick`
 * drains the queue through a real timer rather than nudging it one microtask.
 */
const gmUser = { id: 'gm1', role: 4 };

export interface Table {
  readonly calls: { path: string; body?: object }[];
  readonly warnings: string[];
  readonly confirms: { content: string }[];
  readonly tick: () => Promise<void>;
  readonly stop: () => void;
}

export const table = (options: {
  on?: boolean;
  world?: unknown;
  activeGm?: { id: string; role: number } | null;
  me?: { id: string; role: number };
  confirm?: (options: object) => Promise<unknown>;
  status?: number;
  decisionStatus?: number;
  throws?: boolean;
  throwValue?: unknown;
  pending?: unknown[];
}): Table => {
  const calls: { path: string; body?: object }[] = [];
  const warnings: string[] = [];
  const confirms: { content: string }[] = [];
  const settings = {
    register: vi.fn(),
    get: (_module: string, key: string) =>
      key === 'approveWorldSwaps' ? (options.on ?? true) : undefined,
  };
  const globals = {
    game: {
      user: options.me ?? gmUser,
      users: { activeGM: options.activeGm === undefined ? gmUser : options.activeGm },
      world: { id: options.world === undefined ? 'doomsday-funtime' : options.world },
    },
    foundry: {
      applications: {
        api: {
          DialogV2: {
            confirm: (dialog: object) => {
              confirms.push(dialog as { content: string });
              return (options.confirm ?? (() => Promise.resolve(true)))(dialog);
            },
          },
        },
      },
    },
    ui: {
      notifications: {
        warn: (message: string) => warnings.push(message),
      },
    },
  } as unknown as SwapGlobals;
  const client = {
    call: (_method: 'GET' | 'POST', path: string, body?: object) => {
      calls.push({ path, ...(body === undefined ? {} : { body }) });
      if (options.throws === true || options.throwValue !== undefined) {
        /* A browser throws things that are not Errors, and the heartbeat has to log those too,
           which is the one case this fixture cannot express without breaking the rule. */
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject(options.throwValue ?? new Error('COO is unreachable'));
      }
      const decision = path.endsWith('/decision');
      const response: CooResponse = {
        status: (decision ? options.decisionStatus : options.status) ?? 200,
        json: () => Promise.resolve({ pending: options.pending ?? [] }),
      };
      return Promise.resolve(response);
    },
  } as unknown as CooClient;

  let beat: (() => void) | null = null;
  let stopped = 0;
  const timers: SwapTimers = {
    every: (run) => {
      beat = run;
      return 'handle';
    },
    stop: (handle) => {
      expect(handle).toBe('handle');
      stopped += 1;
    },
  };
  const stop = startWorldSwaps(settings, globals, client, timers);
  return {
    calls,
    warnings,
    confirms,
    tick: async () => {
      beat?.();
      /* One beat is several awaits deep (call, json, dialog, call), so the queue is drained, not nudged. */
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    stop: () => {
      stop();
      expect(stopped).toBe(1);
    },
  };
};
