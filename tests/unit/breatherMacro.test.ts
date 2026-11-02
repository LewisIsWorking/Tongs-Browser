import { describe, expect, it, vi } from 'vitest';

import {
  BREATHER_COMMAND,
  breatherApi,
  ensureBreatherMacro,
  registerBreatherSetting,
  startBreatherMacro,
} from '../../src/breather/breatherMacro.js';
import type { MacroGlobals } from '../../src/breather/breatherMacro.js';
import { BREATHER_TITLE } from '../../src/breather/takeABreather.js';

/**
 * Where players find Take a Breather (No-Limit Stamina), 2026-11-02: a world Script macro the active full GM's
 * browser makes once, in Stamina worlds only, and the module `api` call it runs.
 */
const world = (
  options: {
    role?: number;
    me?: string;
    stamina?: unknown;
    made?: unknown;
    existing?: { name?: string; flag?: unknown };
    implementation?: boolean;
    noMacroClass?: boolean;
    fail?: boolean;
  } = {}
) => {
  const create = vi.fn(async () =>
    options.fail === true ? Promise.reject(new Error('refused')) : Promise.resolve()
  );
  const info = vi.fn();
  const stored = new Map<string, unknown>([['tongs-browser.breatherMacroMade', options.made]]);
  const settings = {
    register: vi.fn(),
    get: vi.fn((module: string, key: string) => stored.get(`${module}.${key}`)),
    set: vi.fn(async (module: string, key: string, value: unknown) => {
      stored.set(`${module}.${key}`, value);
      return Promise.resolve(value);
    }),
  };
  const macros =
    options.existing === undefined
      ? []
      : [{ name: options.existing.name, getFlag: () => options.existing?.flag }];
  const macroClass = options.implementation === true ? { implementation: { create } } : { create };
  const globals = {
    game: {
      user: { id: options.me ?? 'gm', role: options.role ?? 4 },
      users: { activeGM: { id: 'gm', role: options.role ?? 4 } },
      pf2e: { settings: { variants: { stamina: options.stamina ?? true } } },
      macros: { find: (test: (macro: object) => boolean) => macros.find(test) },
    },
    ui: { notifications: { info } },
    ...(options.noMacroClass === true ? {} : { Macro: macroClass }),
  } as unknown as MacroGlobals;
  return { settings, globals, create, info, stored };
};

describe('the breather macro', () => {
  it('is made once, as a Script macro every player may run, and the GM is told', async () => {
    const w = world();
    const told = await ensureBreatherMacro(w.settings, w.globals);

    expect(w.create).toHaveBeenCalledWith({
      name: BREATHER_TITLE,
      type: 'script',
      scope: 'global',
      img: 'icons/svg/unconscious.svg',
      command: BREATHER_COMMAND,
      ownership: { default: 1 },
      flags: { 'tongs-browser': { breatherNoLimit: true } },
    });
    expect(told).toContain('Take a Breather (No-Limit Stamina)');
    expect(w.info).toHaveBeenCalledWith(told);
    expect(w.stored.get('tongs-browser.breatherMacroMade')).toBe(true);

    expect(await ensureBreatherMacro(w.settings, w.globals)).toBeNull();
    expect(w.create).toHaveBeenCalledTimes(1);
  });

  it("uses the system's configured Macro class when there is one", async () => {
    const w = world({ implementation: true });
    await ensureBreatherMacro(w.settings, w.globals);
    expect(w.create).toHaveBeenCalledTimes(1);
  });

  it('is never made by a player, an assistant, another GM, or outside a Stamina world', async () => {
    for (const options of [{ role: 1 }, { role: 3 }, { me: 'other-gm' }, { stamina: false }]) {
      const w = world(options);
      expect(await ensureBreatherMacro(w.settings, w.globals)).toBeNull();
      expect(w.create).not.toHaveBeenCalled();
      expect(w.settings.set).not.toHaveBeenCalled();
    }
  });

  it('is not made again once made, even after a GM deleted it', async () => {
    const w = world({ made: true });
    expect(await ensureBreatherMacro(w.settings, w.globals)).toBeNull();
    expect(w.create).not.toHaveBeenCalled();
  });

  it('counts a macro already there, by our flag or by name, as made', async () => {
    for (const existing of [{ flag: true }, { name: BREATHER_TITLE }]) {
      const w = world({ existing });
      expect(await ensureBreatherMacro(w.settings, w.globals)).toBeNull();
      expect(w.create).not.toHaveBeenCalled();
      expect(w.stored.get('tongs-browser.breatherMacroMade')).toBe(true);
    }
    const other = world({ existing: { name: 'Take a Breather' } });
    await ensureBreatherMacro(other.settings, other.globals);
    expect(other.create).toHaveBeenCalledTimes(1);
  });

  it('does nothing, and remembers nothing, without a Macro class to make it with', async () => {
    const w = world({ noMacroClass: true });
    expect(await ensureBreatherMacro(w.settings, w.globals)).toBeNull();
    expect(w.settings.set).not.toHaveBeenCalled();
  });

  it('registers a hidden world setting, and a failed create is logged, not thrown', async () => {
    const w = world({ fail: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    startBreatherMacro(w.settings, w.globals);
    expect(w.settings.register).toHaveBeenCalledWith('tongs-browser', 'breatherMacroMade', {
      scope: 'world',
      config: false,
      type: Boolean,
      default: false,
    });
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalled();
    });
    expect(String(warn.mock.calls[0])).toContain('The breather macro was not made: refused');
    expect(w.stored.get('tongs-browser.breatherMacroMade')).toBeUndefined();
    warn.mockRestore();
  });

  it('logs a thrown non-Error too', async () => {
    const settings = {
      register: vi.fn(),
      get: () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- a non-Error throw is the case under test
        throw 'odd';
      },
      set: vi.fn(),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    startBreatherMacro(settings, world().globals);
    await vi.waitFor(() => {
      expect(String(warn.mock.calls[0])).toContain('not made: odd');
    });
    warn.mockRestore();
  });

  it("runs the api's call, which the macro guards against Tongs being off", async () => {
    const warn = vi.fn();
    const api = breatherApi({ ui: { notifications: { warn } } });
    expect(await api.takeABreatherNoLimit()).toEqual({ kind: 'no-stamina' });
    expect(warn).toHaveBeenCalled();
    expect(BREATHER_COMMAND).toContain("game.modules.get('tongs-browser')");
    expect(BREATHER_COMMAND).toContain('tongs.api.takeABreatherNoLimit()');
    expect(BREATHER_COMMAND).toContain('ui.notifications.warn(');
  });

  it('only registers when asked to', () => {
    const settings = { register: vi.fn(), get: vi.fn(), set: vi.fn() };
    registerBreatherSetting(settings);
    expect(settings.register).toHaveBeenCalledTimes(1);
  });
});
