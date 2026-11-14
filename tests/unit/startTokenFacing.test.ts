import { describe, expect, it, vi } from 'vitest';

import {
  FACING_SETTING,
  applyTokenFacing,
  facingApi,
  keepMirrorTicks,
  startTokenFacing,
} from '../../src/facing/startTokenFacing.js';
import type { FacingGlobals } from '../../src/facing/startTokenFacing.js';
import { logger } from '../../src/core/Logger.js';

/**
 * Default token facing's wiring, 2026-11-14: the world setting, the creation hooks, the GM's button and
 * API call, and keeping the Mirror ticks when PF2e's auto-scale locks the Scale slider.
 */
type Handler = (...args: unknown[]) => unknown;

const world = (options: { on?: unknown; gm?: boolean; confirm?: unknown; ui?: boolean } = {}) => {
  const handlers = new Map<string, Handler>();
  const hooks = {
    on: vi.fn((name: string, handler: Handler) => {
      handlers.set(name, handler);
      return 1;
    }),
  } as unknown as FoundryHooks;
  const settings = {
    register: vi.fn(),
    get: vi.fn(() => options.on),
    registerMenu: vi.fn(),
  };
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
};

const creating = (source: object) => ({ _source: source, updateSource: vi.fn() });

describe('the default token facing setting', () => {
  it('is a world setting, shown in the settings, and on by default', () => {
    const w = world();
    startTokenFacing(w.hooks, w.settings, w.globals);

    expect(w.settings.register).toHaveBeenCalledWith(
      'tongs-browser',
      FACING_SETTING,
      expect.objectContaining({
        name: 'Default token facing: mirror both ways, unlocked rotation',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
      })
    );
  });
});

describe('a new actor', () => {
  it("gets a prototype mirrored both ways and free to turn, over PF2e's locked rotation", () => {
    const w = world();
    startTokenFacing(w.hooks, w.settings, w.globals);
    const actor = creating({
      prototypeToken: { texture: { scaleX: 1, scaleY: 1 }, lockRotation: true },
    });

    w.handlers.get('preCreateActor')?.(actor, { name: 'Goblin' }, {}, 'gm');

    expect(actor.updateSource).toHaveBeenCalledWith({
      prototypeToken: { texture: { scaleX: -1, scaleY: -1 }, lockRotation: false },
    });
  });

  it('keeps a mirror its creator asked for', () => {
    const w = world();
    startTokenFacing(w.hooks, w.settings, w.globals);
    const actor = creating({ prototypeToken: { texture: { scaleX: -1, scaleY: 1 } } });

    w.handlers.get('preCreateActor')?.(actor, { prototypeToken: { texture: { scaleX: -1 } } });

    expect(actor.updateSource).not.toHaveBeenCalled();
  });

  it('is left alone when a GM has switched the setting off', () => {
    const w = world({ on: false });
    startTokenFacing(w.hooks, w.settings, w.globals);
    const actor = creating({ prototypeToken: { texture: { scaleX: 1, scaleY: 1 } } });

    w.handlers.get('preCreateActor')?.(actor, {});

    expect(actor.updateSource).not.toHaveBeenCalled();
  });
});

describe('a new token', () => {
  it('with art mirrored both ways is placed at 180, upright', () => {
    const w = world();
    startTokenFacing(w.hooks, w.settings, w.globals);
    const token = creating({ texture: { scaleX: -1, scaleY: -1 }, rotation: 0 });

    w.handlers.get('preCreateToken')?.(token, {}, {}, 'player');

    expect(token.updateSource).toHaveBeenCalledWith({ rotation: 180 });
  });

  it('is left alone when unmirrored, already turned, or the setting is off', () => {
    const w = world();
    startTokenFacing(w.hooks, w.settings, w.globals);
    const plain = creating({ texture: { scaleX: 1, scaleY: 1 }, rotation: 0 });
    const turned = creating({ texture: { scaleX: -1, scaleY: -1 }, rotation: 45 });
    const bare = { updateSource: vi.fn() };
    w.handlers.get('preCreateToken')?.(plain);
    w.handlers.get('preCreateToken')?.(turned);
    w.handlers.get('preCreateToken')?.(bare);
    const off = world({ on: false });
    startTokenFacing(off.hooks, off.settings, off.globals);
    const mirrored = creating({ texture: { scaleX: -1, scaleY: -1 } });
    off.handlers.get('preCreateToken')?.(mirrored);

    for (const token of [plain, turned, bare, mirrored]) {
      expect(token.updateSource).not.toHaveBeenCalled();
    }
  });
});

describe('applying the facing to every actor', () => {
  it('changes only the actors not already facing that way, and tells the GM how many', async () => {
    const w = world();

    await expect(applyTokenFacing(w.globals)).resolves.toBe(2);
    expect(w.updateDocuments).toHaveBeenCalledWith([
      { _id: 'new', prototypeToken: { texture: { scaleX: -1, scaleY: -1 }, lockRotation: false } },
      {
        _id: 'small',
        prototypeToken: { texture: { scaleX: -0.8, scaleY: -0.8 }, lockRotation: false },
      },
    ]);
    expect(w.info).toHaveBeenCalledWith('Tongs set the default token facing on 2 actors.');
  });

  it('writes nothing when every actor already faces that way, and says so', async () => {
    const w = world({ ui: false });
    const done = {
      contents: [
        {
          id: 'done',
          prototypeToken: { texture: { scaleX: -1, scaleY: -1 }, lockRotation: false },
        },
      ],
    };
    const globals = {
      ...w.globals,
      game: { ...w.globals.game, actors: { ...w.globals.game?.actors, ...done } },
    } as FacingGlobals;

    await expect(applyTokenFacing(globals)).resolves.toBe(0);
    expect(w.updateDocuments).not.toHaveBeenCalled();
  });

  it('names one actor in the singular', async () => {
    const w = world();
    const one = { contents: [{ id: 'new', prototypeToken: {} }] };
    const globals = {
      ...w.globals,
      game: { ...w.globals.game, actors: { ...w.globals.game?.actors, ...one } },
    } as FacingGlobals;

    await applyTokenFacing(globals);

    expect(w.info).toHaveBeenCalledWith('Tongs set the default token facing on 1 actor.');
  });

  it("does nothing in a player's browser, or where there are no actors", async () => {
    const w = world({ gm: false });

    await expect(applyTokenFacing(w.globals)).resolves.toBeNull();
    await expect(applyTokenFacing({ game: { user: { isGM: true } } })).resolves.toBeNull();
    expect(w.updateDocuments).not.toHaveBeenCalled();
  });

  it("is the API's applyTokenFacingToAllActors, for a GM's macro", async () => {
    const w = world();

    await expect(facingApi(w.globals).applyTokenFacingToAllActors()).resolves.toBe(2);
  });
});

describe("the GM's settings button", () => {
  const press = async (w: ReturnType<typeof world>): Promise<void> => {
    startTokenFacing(w.hooks, w.settings, w.globals);
    const menu = w.settings.registerMenu.mock.calls[0]?.[2] as {
      type: new () => { render(): unknown };
      restricted: boolean;
    };
    expect(menu.restricted).toBe(true);
    new menu.type().render();
    await vi.waitFor(() => {
      expect(w.confirm).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();
  };

  it('asks first, then applies', async () => {
    const w = world({ confirm: true });
    await press(w);

    await vi.waitFor(() => {
      expect(w.updateDocuments).toHaveBeenCalledTimes(1);
    });
  });

  it('changes nothing when the GM says no', async () => {
    const w = world({ confirm: false });
    await press(w);

    expect(w.updateDocuments).not.toHaveBeenCalled();
  });

  it('logs a failure rather than throwing it into Foundry', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const w = world();
    w.updateDocuments.mockRejectedValueOnce(new Error('refused'));
    await press(w);

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith('Default token facing was not applied: refused');
    });
    expect(w.info).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('the Mirror ticks with PF2e auto-scale on (PF2e 8.7, Foundry 14.370)', () => {
  const form = () => {
    const listeners: ((event: Event) => void)[] = [];
    return {
      listeners,
      addEventListener: vi.fn((_type: string, listener: (event: Event) => void) =>
        listeners.push(listener)
      ),
      fire: (object: Record<string, unknown>) => {
        for (const listener of listeners) {
          listener({ formData: { object } } as unknown as Event);
        }
        return object;
      },
    };
  };

  it('fills in the saved size the locked slider left out, so core keeps the ticks', () => {
    const f = form();
    keepMirrorTicks({
      form: f as unknown as EventTarget,
      token: { _source: { texture: { scaleX: -0.8 } } },
    });

    expect(f.addEventListener).toHaveBeenCalledWith('formdata', expect.any(Function));
    expect(f.fire({ mirrorX: true, mirrorY: true })).toEqual({
      mirrorX: true,
      mirrorY: true,
      scale: 0.8,
    });
  });

  it('leaves a submitted scale alone, as once PF2e or core fixes this', () => {
    const f = form();
    keepMirrorTicks({ form: f as unknown as EventTarget });

    expect(f.fire({ scale: 1.2, mirrorX: true })).toEqual({ scale: 1.2, mirrorX: true });
    expect(f.fire({ mirrorY: true })).toEqual({ mirrorY: true, scale: 1 });
    f.listeners[0]?.({} as Event);
  });

  it('listens once per form, however often it renders, and on every Prototype Token form', () => {
    const f = form();
    const app = { form: f as unknown as EventTarget };
    keepMirrorTicks(app);
    keepMirrorTicks(app);
    keepMirrorTicks({ form: null });
    keepMirrorTicks({});
    const w = world();
    startTokenFacing(w.hooks, w.settings, w.globals);

    expect(f.addEventListener).toHaveBeenCalledTimes(1);
    expect(w.handlers.get('renderPrototypeTokenConfig')).toBe(keepMirrorTicks);
  });
});
