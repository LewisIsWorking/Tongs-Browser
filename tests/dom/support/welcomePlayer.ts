import { vi } from 'vitest';

import { PARTIES_SETTING, WELCOME_SETTING } from '../../../src/welcome/startSheetRequests.js';
import type { WelcomeGlobals, WelcomeSettings } from '../../../src/welcome/startSheetRequests.js';

/** A player's browser for the welcome: their user, the world's settings and hooks. 2026-10-05. */
export const PARTY = { uuid: 'Actor.P', name: 'The Party', code: 'C06' };

export function player(options: { on?: boolean; parties?: unknown[]; isGM?: boolean } = {}) {
  const userFlags: Record<string, unknown> = {};
  const values: Record<string, unknown> = {
    [WELCOME_SETTING]: options.on ?? true,
    [PARTIES_SETTING]: { parties: options.parties ?? [PARTY] },
  };
  const user = {
    id: 'u1',
    isGM: options.isGM ?? false,
    getFlag: (_scope: string, key: string) => userFlags[key],
    setFlag: vi.fn(async (_scope: string, key: string, value: unknown) => {
      userFlags[key] = value;
      return Promise.resolve();
    }),
    unsetFlag: vi.fn(async (_scope: string, key: string) => {
      userFlags[key] = undefined;
      return Promise.resolve();
    }),
  };
  const actors: Record<string, unknown>[] = [];
  const game = {
    user,
    users: { activeGM: null },
    actors: { contents: actors },
    world: { title: 'Riddleport' },
  };
  const handlers: (() => void)[] = [];
  const hooks = { on: (_name: string, fn: () => void) => handlers.push(fn) };
  const settings: WelcomeSettings = {
    register: vi.fn(),
    get: (_namespace, key) => values[key],
    set: vi.fn(),
  };
  const globals = { game, crypto: { randomUUID: () => 'r1' } } as unknown as WelcomeGlobals;
  const change = () => {
    handlers[0]?.();
  };
  return { userFlags, values, user, actors, hooks, settings, globals, change };
}

export const welcomeText = () => document.querySelector('#tongs-welcome')?.textContent ?? null;

export const press = (text: string) => {
  [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((b) => b.textContent === text)
    ?.click();
};
