import { vi } from 'vitest';

import type { BreatherActor, BreatherGlobals } from '../../../src/breather/takeABreather.js';

/** A PF2e Stamina world and its characters, faked as far as Take a Breather (No-Limit Stamina) reads. 2026-11-02. */
export const character = (
  over: { name?: string; sp?: { value: number; max: number } | null; inCombat?: boolean } = {}
) => {
  const update = vi.fn(async () => Promise.resolve());
  const actor = {
    id: over.name ?? 'Kibwe',
    uuid: `Actor.${over.name ?? 'Kibwe'}`,
    name: over.name ?? 'Kibwe',
    inCombat: over.inCombat ?? false,
    system: {
      attributes: { hp: { sp: over.sp === undefined ? { value: 3, max: 20 } : over.sp } },
      resources: { resolve: { value: 0, max: 3 } },
    },
    isOfType: (...types: string[]) => types.includes('character'),
    getActiveTokens: () => [
      { name: `${over.name ?? 'Kibwe'} (token)`, texture: { src: 'tokens/kibwe.webp' } },
    ],
    update,
  };
  return { actor: actor as BreatherActor, update };
};

export const world = (
  options: {
    stamina?: unknown;
    tokens?: { actor?: BreatherActor | null }[];
    character?: BreatherActor | null;
    confirm?: unknown;
    started?: boolean;
    noDialog?: boolean;
  } = {}
) => {
  const warn = vi.fn();
  const error = vi.fn();
  const confirm = vi.fn(async () => Promise.resolve(options.confirm ?? true));
  const create = vi.fn(async () => Promise.resolve());
  const getSpeaker = vi.fn((given: { token?: { name?: string } }) => ({
    alias: given.token?.name,
  }));
  const globals: BreatherGlobals = {
    game: {
      pf2e: { settings: { variants: { stamina: options.stamina ?? true } } },
      user: {
        character: options.character ?? null,
        getActiveTokens: () => options.tokens ?? [],
      },
      combat: { started: options.started ?? false },
    },
    ui: { notifications: { warn, error } },
    ...(options.noDialog === true
      ? {}
      : { foundry: { applications: { api: { DialogV2: { confirm } } } } }),
    ChatMessage: { implementation: { getSpeaker, create } },
  };
  return { globals, warn, error, confirm, create, getSpeaker };
};
