import { vi } from 'vitest';

import type { FacingGlobals } from '../../../src/facing/startTokenFacing.js';

/**
 * A world for default token facing (src/facing), 2026-11-14: hooks captured by name, a settings stub
 * with a restricted-menu slot, and four actors, one already facing the default way and one unsaved.
 */
export type Handler = (...args: unknown[]) => unknown;

export interface FacingWorldOptions {
  /** The setting's stored value; unset reads as on. */
  readonly on?: unknown;
  readonly gm?: boolean;
  /** What the GM answers in the "apply to every actor" dialog. */
  readonly confirm?: unknown;
  /** False for a world with no `ui`, so nothing can be told. */
  readonly ui?: boolean;
}

export function facingWorld(options: FacingWorldOptions = {}) {
  const handlers = new Map<string, Handler>();
  const hooks = {
    on: vi.fn((name: string, handler: Handler) => {
      handlers.set(name, handler);
      return 1;
    }),
  } as unknown as FoundryHooks;
  const settings = { register: vi.fn(), get: vi.fn(() => options.on), registerMenu: vi.fn() };
  const updateDocuments = vi.fn(async () => Promise.resolve([]));
  const info = vi.fn();
  const confirm = vi.fn(async () => Promise.resolve(options.confirm ?? true));
  class ApplicationV2 {
    render(): unknown {
      return this;
    }
  }
  const globals = {
    game: {
      user: { isGM: options.gm ?? true },
      actors: {
        contents: [
          { id: 'new', prototypeToken: { texture: { scaleX: 1, scaleY: 1 }, lockRotation: true } },
          {
            id: 'done',
            prototypeToken: { texture: { scaleX: -1, scaleY: -1 }, lockRotation: false },
          },
          { id: null, prototypeToken: {} },
          { id: 'small', prototypeToken: { texture: { scaleX: 0.8, scaleY: 0.8 } } },
        ],
        documentClass: { updateDocuments },
      },
    },
    foundry: { applications: { api: { ApplicationV2, DialogV2: { confirm } } } },
    ...(options.ui === false ? {} : { ui: { notifications: { info } } }),
  } as unknown as FacingGlobals;
  return { handlers, hooks, settings, globals, updateDocuments, info, confirm };
}

export type FacingWorld = ReturnType<typeof facingWorld>;

/** The same world with only these actors in it. */
export function withActors(world: FacingWorld, contents: readonly object[]): FacingGlobals {
  const game = world.globals.game;
  return {
    ...world.globals,
    game: { ...game, actors: { ...game?.actors, contents } },
  } as FacingGlobals;
}
