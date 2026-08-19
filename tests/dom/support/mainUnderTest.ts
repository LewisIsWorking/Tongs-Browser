import { vi } from 'vitest';

import { stubFoundryEnvironment } from './moduleUnderTest.js';

/**
 * The module entry point: what happens at `init`, and what happens at `ready`.
 *
 * ⚠️ `src/main.ts` was at **0% coverage** until 2026-08-18, and it is the file that decides whether
 * the module loads at all. Every failure it can have is silent and total: no settings, no scene
 * control, no API, and a console that says nothing unusual. Nothing but a live run would have caught
 * one, which is the definition of the gap worth closing first.
 *
 * These assert OUTCOMES a regression would actually break, not that particular functions were called:
 * the toggle exists after init, the API is on the module entry after ready, the module is enabled
 * only when the setting says so.
 */

/** Hook registrations, captured so the callbacks can be invoked in the order Foundry would. */
export interface CapturedHooks {
  once: Map<string, () => void>;
  on: Map<string, () => void>;
  off: string[];
}

export function captureHooks(): CapturedHooks {
  const captured: CapturedHooks = { once: new Map(), on: new Map(), off: [] };
  Object.assign(globalThis, {
    Hooks: {
      once: (name: string, callback: () => void) => {
        captured.once.set(name, callback);
        return 1;
      },
      on: (name: string, callback: () => void) => {
        captured.on.set(name, callback);
        return 1;
      },
      off: (name: string) => {
        captured.off.push(name);
      },
    },
  });
  return captured;
}

interface Registered {
  key: string;
  onChange?: () => void;
}

/** A settings backend that records what was registered and lets a test choose stored values. */
export function stubSettings(values: Record<string, unknown> = {}) {
  const registered: Registered[] = [];
  const stored = new Map<string, unknown>(Object.entries(values));
  return {
    registered,
    stored,
    api: {
      register: (_namespace: string, key: string, options: { onChange?: () => void }) => {
        registered.push({ key, ...(options.onChange ? { onChange: options.onChange } : {}) });
      },
      get: (_namespace: string, key: string) => stored.get(key),
      set: (_namespace: string, key: string, value: unknown) => {
        stored.set(key, value);
        return Promise.resolve(value);
      },
    },
  };
}

/**
 * The stubbed `game`, typed for writing.
 *
 * `globalThis.game` is declared by `src/types/foundry.d.ts` for the module's own use, where it is
 * read only. These tests need to REPLACE parts of it, so they reach it through one cast in one place
 * rather than scattering the same assertion through every setup.
 */
export function foundryGame(): Record<string, unknown> {
  return (globalThis as unknown as { game: Record<string, unknown> }).game;
}

export interface ModuleEntry {
  api?: unknown;
}

export async function bootMain(values: Record<string, unknown> = {}) {
  stubFoundryEnvironment();
  const hooks = captureHooks();
  const settings = stubSettings(values);
  const moduleEntry: ModuleEntry = {};

  const game = foundryGame();
  game['settings'] = settings.api;
  game['modules'] = { get: () => moduleEntry };

  vi.resetModules();
  await import('../../../src/main.js');
  return { hooks, settings, moduleEntry };
}
