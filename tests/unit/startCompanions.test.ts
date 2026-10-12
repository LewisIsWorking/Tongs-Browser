import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/core/Logger.js';
import { startCompanions } from '../../src/welcome/startCompanions.js';
import { WELCOME_SETTING } from '../../src/welcome/startSheetRequests.js';
import type { WelcomeSettings } from '../../src/welcome/startSheetRequests.js';

/** Companion sheets wired to Foundry: the actor made, joined, marked, and the player told. 2026-10-12. */
afterEach(() => {
  vi.unstubAllGlobals();
});

const flags =
  (values: Record<string, unknown>) =>
  (scope: string, key: string): unknown =>
    scope === 'tongs-browser' ? values[key] : undefined;

function table(
  options: { slugs?: string[]; isGM?: boolean; packs?: boolean; system?: string } = {}
) {
  const gm = { id: 'gm', name: 'GM', isGM: true, role: 4 };
  const lai = { id: 'u1', name: 'Lai', role: 1 };
  const kibwe = {
    id: 'A',
    uuid: 'Actor.A',
    name: 'Kibwe',
    type: 'character',
    ownership: { u1: 3 },
    items: {
      contents: (options.slugs ?? ['familiar-witch']).map((slug) => ({ system: { slug } })),
    },
    getFlag: flags({}),
  };
  const party = {
    uuid: 'Actor.P',
    name: 'The Party',
    type: 'party',
    getFlag: flags({}),
    system: { details: { members: [{ uuid: 'Actor.A' }] } },
  };
  const actors = [party, kibwe];
  const packGet = vi.fn((id: string) =>
    options.packs === false ? undefined : { metadata: { label: `CC ${id}` } }
  );
  const game = {
    user: options.isGM === false ? lai : gm,
    users: { activeGM: gm, contents: [gm, lai] },
    actors: Object.assign(actors, { contents: actors }),
    system: { id: options.system ?? 'pf2e' },
    packs: { get: packGet },
  };
  return { game, packGet };
}

function stubFoundry() {
  const create = vi.fn(async () => Promise.resolve({ uuid: 'Actor.NEW' }));
  const addMembers = vi.fn(async () => Promise.resolve());
  const setFlag = vi.fn(async () => Promise.resolve());
  const chat = vi.fn(async () => Promise.resolve());
  vi.stubGlobal('fromUuid', async (uuid: string) =>
    Promise.resolve(uuid === 'Actor.P' ? { addMembers } : { uuid, setFlag })
  );
  return { create, addMembers, setFlag, chat };
}

const settings = (on = true): WelcomeSettings => ({
  register: vi.fn(),
  get: (_namespace, key) => (key === WELCOME_SETTING ? on : undefined),
  set: vi.fn(),
});

describe('making a companion in a real world', () => {
  it("makes a witch's familiar on PF2e's familiar sheet, owned by the player, with its master", async () => {
    const { create, addMembers, setFlag, chat } = stubFoundry();
    const info = vi.fn();
    const names: string[] = [];
    startCompanions({ on: (name: string) => names.push(name) }, settings(), {
      game: table().game,
      ui: { notifications: { info } },
      Actor: { create },
      ChatMessage: { create: chat },
    } as never);
    await vi.waitFor(() => {
      expect(setFlag).toHaveBeenCalled();
    });
    expect(create).toHaveBeenCalledWith({
      name: "Kibwe's Familiar",
      type: 'familiar',
      ownership: { u1: 3 },
      system: { master: { id: 'A' } },
      flags: { 'tongs-browser': { companionOf: 'Actor.A', companionKind: 'familiar' } },
    });
    expect(addMembers).toHaveBeenCalledWith({ uuid: 'Actor.NEW', setFlag });
    expect(setFlag).toHaveBeenCalledWith('tongs-browser', 'companionsMade', ['familiar']);
    expect(info).toHaveBeenCalledWith("Tongs made Kibwe's Familiar for Lai.");
    expect(chat).toHaveBeenCalledWith({
      content:
        '<p>Tongs made Kibwe&#39;s Familiar for you, in your party. Open it and choose its familiar abilities.</p>',
      whisper: ['u1'],
      speaker: { alias: 'Tongs' },
    });
    expect(names).toContain('createItem');
  });

  it("makes an eidolon as a character, naming SF2e's Companion Compendia pack", async () => {
    const { create, chat } = stubFoundry();
    const { game, packGet } = table({ slugs: ['eidolon'], system: 'sf2e' });
    startCompanions({ on: vi.fn() }, settings(), {
      game,
      Actor: { create },
      ChatMessage: { create: chat },
    } as never);
    await vi.waitFor(() => {
      expect(chat).toHaveBeenCalled();
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Kibwe's Eidolon", type: 'character' })
    );
    expect(create).not.toHaveBeenCalledWith(expect.objectContaining({ system: expect.anything() }));
    expect(packGet).toHaveBeenCalledWith('pf2e-animal-companions.sf-AC-Eidolons');
  });

  it('tells the GM when Companion Compendia is missing, and when Foundry cannot create', async () => {
    stubFoundry();
    const info = vi.fn();
    startCompanions({ on: vi.fn() }, settings(), {
      game: table({ slugs: ['eidolon'], packs: false }).game,
      ui: { notifications: { info } },
      Actor: { create: async () => Promise.resolve({ uuid: 'Actor.NEW' }) },
    } as never);
    await vi.waitFor(() => {
      expect(info).toHaveBeenCalledWith(expect.stringContaining('pack is missing here'));
    });

    const failed = vi.fn();
    startCompanions({ on: vi.fn() }, settings(), {
      game: table().game,
      ui: { notifications: { info: failed } },
    } as never);
    await vi.waitFor(() => {
      expect(failed).toHaveBeenCalledWith(
        "Tongs could not make Kibwe's Familiar for Lai: Foundry has no Actor.create on this client."
      );
    });

    const nothing = vi.fn();
    startCompanions({ on: vi.fn() }, settings(), {
      game: table().game,
      ui: { notifications: { info: nothing } },
      Actor: { create: async () => Promise.resolve(null) },
    } as never);
    await vi.waitFor(() => {
      expect(nothing).toHaveBeenCalledWith(expect.stringContaining('Foundry returned no actor.'));
    });
  });

  it('does nothing when switched off, or in a player browser', async () => {
    const { create } = stubFoundry();
    startCompanions({ on: vi.fn() }, settings(false), {
      game: table().game,
      Actor: { create },
    } as never);
    startCompanions({ on: vi.fn() }, settings(), {
      game: table({ isGM: false }).game,
      Actor: { create },
    } as never);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(create).not.toHaveBeenCalled();
  });

  it('logs a pass that throws, rather than leaving a rejection', async () => {
    stubFoundry();
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    startCompanions({ on: vi.fn() }, settings(), {
      game: {
        ...table().game,
        get actors(): never {
          throw new Error('boom');
        },
      },
    });
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith('Companion sheets failed: boom');
    });
    warn.mockRestore();
  });
});
