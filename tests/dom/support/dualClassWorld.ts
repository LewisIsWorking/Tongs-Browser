import { vi } from 'vitest';

import {
  DUAL_CLASS_EVENT,
  startDualClassPlayer,
} from '../../../src/dualclass/startDualClassPlayer.js';
import type { DualClassPlayerGlobals } from '../../../src/dualclass/startDualClassPlayer.js';

/**
 * A player's browser with dual class started, for `dualClassPlayer` and `dualClassAnswer`. 2026-10-12.
 * Each world gets a document of its own, so an earlier test's listener never answers this test's event.
 */

export const F = 'Compendium.pf2e.classes.Item.F';
export const W = 'Compendium.pf2e.classes.Item.W';
export const ITEM = {
  name: 'Fighter - Wizard',
  type: 'class',
  img: 'x',
  system: {},
  flags: { 'tongs-browser': { dualClassFor: 'r1' } },
};

export interface Options {
  isGM?: boolean;
  flags?: Record<string, unknown>;
  sheets?: number;
  classes?: string[];
  gm?: boolean;
  create?: () => Promise<unknown>;
  crypto?: boolean;
}

export function table(options: Options = {}) {
  const flags: Record<string, unknown> = { ...options.flags };
  const items: { id: string; type: string; getFlag(s: string, k: string): unknown }[] = [];
  const me = {
    id: 'u1',
    isGM: options.isGM === true,
    getFlag: (_scope: string, key: string) => flags[key],
    setFlag: vi.fn(async (_scope: string, key: string, value: unknown) => {
      flags[key] = value;
      return Promise.resolve();
    }),
    unsetFlag: vi.fn(async (_scope: string, key: string) => {
      Reflect.deleteProperty(flags, key);
      return Promise.resolve();
    }),
  };
  const create = vi.fn(
    options.create ??
      (async () => {
        items.push({ id: 'NEW', type: 'class', getFlag: () => 'r1' });
        return Promise.resolve();
      })
  );
  const kibwe = {
    id: 'A1',
    uuid: 'Actor.A1',
    name: 'Kibwe',
    type: 'character',
    isOwner: true,
    getFlag: () => undefined,
    items: { contents: items },
    createEmbeddedDocuments: create,
    deleteEmbeddedDocuments: vi.fn(),
  };
  const sheets = [kibwe, { ...kibwe, id: 'A2', name: null }, { ...kibwe, id: null }].slice(
    0,
    options.sheets ?? 3
  );
  const entries = (options.classes ?? ['Fighter', 'Wizard']).map((name) => ({
    type: 'class',
    name,
    uuid: name === 'Fighter' ? F : W,
  }));
  const gm = { id: 'gm', name: 'GM', isGM: true };
  const info = vi.fn();
  const hooks: Record<string, () => unknown> = {};
  const globals = {
    game: {
      user: me,
      users: { activeGM: options.gm === false ? null : gm },
      actors: Object.assign(sheets, {
        contents: sheets,
        get: (id: string) => (id === 'A1' ? kibwe : undefined),
      }),
      packs: {
        get: (key: string) =>
          key === 'pf2e.classes' ? { getIndex: async () => Promise.resolve(entries) } : undefined,
      },
    },
    ui: { notifications: { info } },
    ...(options.crypto === false ? {} : { crypto: { randomUUID: () => 'r1' } }),
  } as unknown as DualClassPlayerGlobals;
  const doc = document.implementation.createHTMLDocument('dual class');
  startDualClassPlayer({ on: (name, fn) => (hooks[name] = fn) }, globals, doc);
  return {
    me,
    flags,
    create,
    info,
    hooks,
    doc,
    text: (): string => doc.getElementById('tongs-dual-class')?.textContent ?? '',
    press: (label: string): void => {
      [...doc.querySelectorAll('button')].find((button) => button.textContent === label)?.click();
    },
    choose: (key: string, value: string): void => {
      (doc.getElementById(`tongs-dual-class-${key}`) as HTMLSelectElement).value = value;
    },
    open: async (): Promise<void> => {
      doc.dispatchEvent(new Event(DUAL_CLASS_EVENT));
      await settle();
    },
  };
}

export const settle = async (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
