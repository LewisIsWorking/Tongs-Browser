import { afterEach, describe, expect, it, vi } from 'vitest';

import { startWelcome } from '../../src/welcome/startWelcome.js';
import { SAME_CLASS } from '../../src/dualclass/DualClassWindow.js';
import { player, press, welcomeText } from './support/welcomePlayer.js';

/** The welcome in a world with Dual Class on: one class or two, asked up front. 2026-10-20. */
afterEach(() => {
  document.body.replaceChildren();
});

const F = 'Compendium.pf2e.classes.Item.F';
const W = 'Compendium.pf2e.classes.Item.W';
const settle = async (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** A new player's browser; `dual` is Workbench's Dual Class setting, `undefined` meaning not registered. */
function world(dual: boolean | undefined, classes = ['Fighter', 'Wizard']) {
  const t = player();
  const get = t.settings.get;
  t.settings.get = (namespace, key) => {
    if (namespace === 'xdy-pf2e-workbench') {
      if (dual === undefined) throw new Error(`${namespace}.${key} is not a registered setting`);
      return key === 'legacyVariantRuleDualClass' ? dual : undefined;
    }
    return get(namespace, key);
  };
  const entries = classes.map((name) => ({
    type: 'class',
    name,
    uuid: name === 'Fighter' ? F : W,
  }));
  const getIndex = vi.fn(async () => Promise.resolve(entries));
  Object.assign(t.globals.game!, {
    packs: { get: (key: string) => (key === 'pf2e.classes' ? { getIndex } : undefined) },
  });
  return { ...t, getIndex };
}

const field = (id: string) => document.getElementById(`tongs-welcome-${id}`) as HTMLSelectElement;
const choose = (id: string, value: string) => {
  field(id).value = value;
  field(id).dispatchEvent(new Event('change'));
};

describe('the welcome with Dual Class off', () => {
  it('looks exactly as it always has, off or with no Workbench at all', async () => {
    for (const dual of [false, undefined]) {
      const t = world(dual);
      startWelcome(t.hooks, t.settings, t.globals, document);
      await settle();
      expect(welcomeText()).toContain('Welcome to Riddleport!');
      expect(document.querySelector('#tongs-welcome select')).toBeNull();
      expect(t.getIndex).not.toHaveBeenCalled();
      press('Create my character');
      await vi.waitFor(() => {
        expect(t.userFlags['sheetRequest']).toBeDefined();
      });
      expect(t.userFlags['welcomeDualClass']).toBeUndefined();
      document.body.replaceChildren();
    }
  });
});

describe('the welcome with Dual Class on', () => {
  it('waits for the classes, then asks one class or two', async () => {
    const t = world(true);
    startWelcome(t.hooks, t.settings, t.globals, document);
    expect(welcomeText()).toBeNull();
    await settle();
    expect(welcomeText()).toContain('How many classes? This world uses the Dual Class rule.');
    expect([...field('first').options].map((option) => option.textContent)).toEqual([
      'Fighter',
      'Wizard',
    ]);
    expect(field('first').closest('div')?.hidden).toBe(true);
    choose('classes', 'two');
    expect(field('first').closest('div')?.hidden).toBe(false);
  });

  it('keeps one class as today: no dual class wish is stored', async () => {
    const t = world(true);
    startWelcome(t.hooks, t.settings, t.globals, document);
    await settle();
    press('Create my character');
    await vi.waitFor(() => {
      expect(t.userFlags['sheetRequest']).toMatchObject({ id: 'r1' });
    });
    expect(t.user.unsetFlag).toHaveBeenCalledWith('tongs-browser', 'welcomeDualClass');
    expect(t.userFlags['welcomeDualClass']).toBeUndefined();
  });

  it('stores both classes with the sheet request, written before it', async () => {
    const t = world(true);
    startWelcome(t.hooks, t.settings, t.globals, document);
    await settle();
    choose('classes', 'two');
    choose('first', W);
    choose('second', F);
    press('Create my character');
    await vi.waitFor(() => {
      expect(t.userFlags['sheetRequest']).toMatchObject({ id: 'r1' });
    });
    expect(t.userFlags['welcomeDualClass']).toEqual({ forRequest: 'r1', first: W, second: F });
    const keys = t.user.setFlag.mock.calls.map((call) => call[1]);
    expect(keys).toEqual(['welcomeDualClass', 'sheetRequest']);
  });

  it('refuses the same class twice, asking nothing of a GM', async () => {
    const t = world(true);
    startWelcome(t.hooks, t.settings, t.globals, document);
    await settle();
    choose('classes', 'two');
    choose('second', F);
    press('Create my character');
    await settle();
    expect(welcomeText()).toContain(SAME_CLASS);
    expect(t.user.setFlag).not.toHaveBeenCalled();
  });

  it('offers one class only, as today, when the compendiums give fewer than two or fail', async () => {
    const few = world(true, ['Fighter']);
    startWelcome(few.hooks, few.settings, few.globals, document);
    await settle();
    expect(welcomeText()).toContain('Welcome to Riddleport!');
    expect(document.querySelector('#tongs-welcome select')).toBeNull();
    document.body.replaceChildren();

    const broken = world(true);
    broken.getIndex.mockRejectedValue(new Error('no pack'));
    startWelcome(broken.hooks, broken.settings, broken.globals, document);
    await settle();
    expect(welcomeText()).toContain('Welcome to Riddleport!');
    expect(document.querySelector('#tongs-welcome select')).toBeNull();
  });
});

describe('from the welcome to the dual class request', () => {
  it('sends the Dual class request for the new sheet once a GM has made it', async () => {
    const t = world(true);
    const handlers: (() => void)[] = [];
    startWelcome({ on: (_name, fn) => handlers.push(fn) }, t.settings, t.globals, document);
    await settle();
    choose('classes', 'two');
    choose('second', W);
    press('Create my character');
    await vi.waitFor(() => {
      expect(t.userFlags['sheetRequest']).toMatchObject({ id: 'r1' });
    });
    /* The GM's browser answers: the request goes, the sheet arrives marked with it. */
    t.userFlags['sheetRequest'] = undefined;
    t.actors.push({
      id: 'NEW',
      uuid: 'Actor.NEW',
      name: 'Theo',
      type: 'character',
      isOwner: true,
      items: { contents: [] },
      getFlag: (_scope: string, key: string) => (key === 'madeForRequest' ? 'r1' : undefined),
    });
    for (const handler of handlers) handler();
    await vi.waitFor(() => {
      expect(t.userFlags['dualClassRequest']).toMatchObject({
        actorId: 'NEW',
        first: F,
        second: W,
      });
    });
    await vi.waitFor(() => {
      expect(t.userFlags['welcomeDualClass']).toBeUndefined();
    });
  });
});
