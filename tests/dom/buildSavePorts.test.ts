import { afterEach, describe, expect, it } from 'vitest';

import { buildSavePorts } from '../../src/deck/buildSavePorts.js';
import type { DeckGlobals } from '../../src/deck/buildApplyPorts.js';

/**
 * The real Foundry behind rolling a save. Written 2026-09-13.
 *
 * ⛔ The fakes read `this`, so a detached `renderHTML` fails here instead of in a game.
 */
afterEach(() => {
  document.body.replaceChildren();
});

describe('rendering the card', () => {
  it('calls renderHTML on the message itself', async () => {
    const message = {
      id: 'msg1',
      async setFlag() {
        return Promise.resolve();
      },
      async renderHTML(this: { id: string }) {
        const li = document.createElement('li');
        li.dataset['messageId'] = this.id;
        return Promise.resolve(li);
      },
    };
    const messages = {
      get(this: unknown, id: string) {
        return id === 'msg1' ? message : undefined;
      },
    };

    const card = await buildSavePorts({ game: { messages } }, document).renderCard('msg1');

    expect(card?.dataset['messageId']).toBe('msg1');
  });

  it('is null when the message is gone', async () => {
    expect(await buildSavePorts({}, document).renderCard('missing')).toBeNull();
  });
});

describe('attaching the card', () => {
  /** ⛔ In the document, so PF2e's document-level inline-check listener hears the click. */
  it('puts it in the document hidden and marked as ours, then takes it out', () => {
    const card = document.createElement('li');

    const detach = buildSavePorts({}, document).attachHidden(card);

    expect(card.isConnected).toBe(true);
    expect(card.parentElement?.hidden).toBe(true);
    expect(card.parentElement?.getAttribute('data-tongs-browser')).toBe('ignore');
    detach();
    expect(card.isConnected).toBe(false);
  });

  it('delivers the click to a listener on the document, carrying Shift', () => {
    const ports = buildSavePorts({}, document);
    const card = document.createElement('li');
    card.innerHTML = '<a data-pf2-check="will">Will</a>';
    const heard: boolean[] = [];
    const listener = (event: MouseEvent) => heard.push(event.shiftKey);
    document.addEventListener('click', listener);

    const detach = ports.attachHidden(card);
    ports.click(card.querySelector('a')!, true);
    detach();
    document.removeEventListener('click', listener);

    expect(heard).toEqual([true]);
  });
});

describe("the GM's dialog setting", () => {
  it('reads showCheckDialogs, treating an absent setting as off', () => {
    const on = { game: { user: { settings: { showCheckDialogs: true } } } } as DeckGlobals;

    expect(buildSavePorts(on, document).showsCheckDialogs()).toBe(true);
    expect(buildSavePorts({}, document).showsCheckDialogs()).toBe(false);
  });
});

describe('knowing every save landed', () => {
  const hooks = () => {
    const handlers = new Map<number, (message: unknown) => void>();
    return {
      handlers,
      on(this: { handlers: Map<number, unknown> }, _name: string, fn: (m: unknown) => void) {
        this.handlers.set(this.handlers.size + 1, fn);
        return this.handlers.size;
      },
      off(this: { handlers: Map<number, unknown> }, _name: string, id: number) {
        this.handlers.delete(id);
      },
      fire(message: unknown) {
        for (const fn of [...handlers.values()]) fn(message);
      },
    };
  };
  const saved = (token: string) => ({
    flags: { sf2e: { context: { type: 'saving-throw' } } },
    speaker: { token },
  });

  it("waits for a saving-throw from each token, in the running system's namespace", async () => {
    const Hooks = hooks();
    const globals = { Hooks, game: { system: { id: 'sf2e' } } } as DeckGlobals;

    const landing = buildSavePorts(globals, document).savesLanded([
      'Scene.S.Token.A',
      'Scene.S.Token.B',
    ]);
    Hooks.fire(saved('A'));
    Hooks.fire(saved('B'));

    await expect(landing).resolves.toBe(true);
  });

  it('is false for a uuid that is not a scene token, hooking nothing', async () => {
    const Hooks = hooks();
    const globals = { Hooks, game: { system: { id: 'pf2e' } } } as DeckGlobals;

    await expect(
      buildSavePorts(globals, document).savesLanded(['Scene.S.Token.A', 'Actor.X'])
    ).resolves.toBe(false);
    expect(Hooks.handlers.size).toBe(0);
  });
});

describe('with no game system known', () => {
  /** ⚠️ Nothing can be read in an empty namespace, so it waits and reports false rather than true. */
  it('never confirms a save', async () => {
    const handlers: ((message: unknown) => void)[] = [];
    const Hooks = {
      on(this: unknown, _name: string, fn: (m: unknown) => void) {
        handlers.push(fn);
        return 1;
      },
      off(this: unknown) {
        return undefined;
      },
    };

    const landing = buildSavePorts({ Hooks } as DeckGlobals, document, 20).savesLanded([
      'Scene.S.Token.A',
    ]);
    handlers.forEach((fn) => {
      fn({ flags: { pf2e: { context: { type: 'saving-throw' } } }, speaker: { token: 'A' } });
    });

    await expect(landing).resolves.toBe(false);
  });
});
