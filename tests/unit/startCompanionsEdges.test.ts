import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/core/Logger.js';
import { startCompanions } from '../../src/welcome/startCompanions.js';
import { WELCOME_SETTING } from '../../src/welcome/startSheetRequests.js';
import type { WelcomeSettings } from '../../src/welcome/startSheetRequests.js';

/**
 * Companion sheets at the edges: no party, a pack with no label, a pass that throws oddly. 2026-10-12.
 * And the character's folder, which its companion is made in (2026-10-22).
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

const settings: WelcomeSettings = {
  register: vi.fn(),
  get: (_namespace, key) => key === WELCOME_SETTING,
  set: vi.fn(),
};

function game(members: string[], pack: object | undefined, folder?: { id: string }) {
  const gm = { id: 'gm', isGM: true, role: 4 };
  const actors = [
    {
      uuid: 'Actor.P',
      name: 'The Party',
      type: 'party',
      system: { details: { members: members.map((uuid) => ({ uuid })) } },
    },
    {
      id: 'A',
      uuid: 'Actor.A',
      name: 'Kibwe',
      type: 'character',
      ownership: { u1: 3 },
      folder,
      items: { contents: [{ slug: 'eidolon' }] },
    },
  ];
  return {
    user: gm,
    users: { activeGM: gm, contents: [gm, { id: 'u1', name: 'Lai', role: 1 }] },
    actors: Object.assign(actors, { contents: actors }),
    packs: { get: () => pack },
  };
}

const settle = async () => new Promise((resolve) => setTimeout(resolve, 0));

describe('companion sheets at the edges', () => {
  it('makes nothing for a character in no party', async () => {
    const create = vi.fn();
    startCompanions({ on: vi.fn() }, settings, { game: game([], {}), Actor: { create } } as never);
    await settle();
    expect(create).not.toHaveBeenCalled();
  });

  it("makes the companion in its character's folder, so it sits next to it", async () => {
    vi.stubGlobal('fromUuid', async () =>
      Promise.resolve({ addMembers: vi.fn(), setFlag: vi.fn() })
    );
    const create = vi.fn(async () => Promise.resolve({ uuid: 'Actor.NEW' }));
    startCompanions({ on: vi.fn() }, settings, {
      game: game(['Actor.A'], {}, { id: 'RIDDLEPORT' }),
      Actor: { create },
    } as never);
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Kibwe's Eidolon", folder: 'RIDDLEPORT' })
      );
    });
  });

  it('names a pack by its title, or by its name when it has neither label nor title', async () => {
    vi.stubGlobal('fromUuid', async () =>
      Promise.resolve({ addMembers: vi.fn(), setFlag: vi.fn() })
    );
    for (const [pack, shown] of [
      [{ title: 'Eidolons' }, '&#34;Eidolons&#34;'],
      [{}, '&#34;AC-Eidolons&#34;'],
    ] as const) {
      const chat = vi.fn(async () => Promise.resolve());
      startCompanions({ on: vi.fn() }, settings, {
        game: game(['Actor.A'], pack),
        Actor: { create: async () => Promise.resolve({ uuid: 'Actor.NEW' }) },
        ChatMessage: { create: chat },
      } as never);
      await vi.waitFor(() => {
        expect(chat).toHaveBeenCalledWith(
          expect.objectContaining({ content: expect.stringContaining(shown) })
        );
      });
    }
  });

  it('logs a pass that throws something that is not an Error', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    startCompanions({ on: vi.fn() }, settings, {
      game: {
        ...game([], {}),
        get actors(): never {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw 'odd';
        },
      },
    });
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith('Companion sheets failed: odd');
    });
    warn.mockRestore();
  });
});
