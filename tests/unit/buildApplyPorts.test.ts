import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApplyPorts, parseTokenUuid } from '../../src/deck/buildApplyPorts.js';
import type { DeckGlobals } from '../../src/deck/buildApplyPorts.js';

/**
 * The real Foundry behind applying a card. Written 2026-09-13.
 *
 * ⛔ EVERY FAKE HERE READS `this`. Twice on 2026-09-12 a Foundry method was called detached and threw on
 * every real Foundry while passing every test, because the test stubs were arrow functions that never
 * read `this`. These fakes are methods that do, so a detached call fails here instead of in a game.
 */
/*
 * ⚠️ A minimal document, because this project runs under node with no DOM. It records what was asked
 * of it; the only thing PF2e reads off the element is `dataset.messageId`.
 */
const doc = {
  createElement: () => ({ dataset: {} as Record<string, string> }),
} as unknown as Document;

afterEach(() => {
  vi.useRealTimers();
});

describe('parsing a token UUID', () => {
  it('splits a scene token UUID into its ids', () => {
    expect(parseTokenUuid('Scene.S1.Token.T1')).toEqual({ sceneId: 'S1', tokenId: 'T1' });
  });

  it('rejects anything that is not a scene token', () => {
    expect(parseTokenUuid('Actor.A1')).toBeNull();
    expect(parseTokenUuid('Scene.S1.Token.T1.Actor.A1')).toBeNull();
  });
});

describe('the context menu entries', () => {
  /** ⛔ PF2e's `_getEntryContextOptions` calls `super` and reads `this`; called bare it would throw. */
  it('are read by calling the method on the chat log', () => {
    const chat = {
      tag: 'the chat log',
      _getEntryContextOptions(this: { tag: string }) {
        return [{ label: this.tag, onClick: () => undefined }];
      },
    };

    const ports = buildApplyPorts({ ui: { chat } }, doc);

    expect(ports.contextEntries()[0]?.label).toBe('the chat log');
  });
});

describe('finding the target token', () => {
  const tokens = {
    store: new Map([['T1', { control: () => undefined, release: () => undefined }]]),
    get(this: { store: Map<string, unknown> }, id: string) {
      return this.store.get(id);
    },
  };

  it('finds a token on the scene being viewed, calling get on the collection', () => {
    const ports = buildApplyPorts({ canvas: { scene: { id: 'S1' }, tokens } } as DeckGlobals, doc);

    expect(ports.tokenFor('Scene.S1.Token.T1')).not.toBeNull();
  });

  /** ⚠️ PF2e applies to controlled tokens, which only exist on the viewed scene. */
  it('treats a token on another scene as gone', () => {
    const ports = buildApplyPorts(
      { canvas: { scene: { id: 'OTHER' }, tokens } } as DeckGlobals,
      doc
    );

    expect(ports.tokenFor('Scene.S1.Token.T1')).toBeNull();
  });
});

describe('the list item PF2e reads', () => {
  it('carries the message id where PF2e looks for it', () => {
    const ports = buildApplyPorts({}, doc);

    expect(ports.listItemFor('msg9').dataset['messageId']).toBe('msg9');
  });
});

describe('knowing the damage landed', () => {
  const hooksWith = () => {
    const handlers = new Map<number, (message: unknown) => void>();
    let next = 1;
    return {
      handlers,
      on(
        this: { handlers: Map<number, (m: unknown) => void> },
        _name: string,
        fn: (m: unknown) => void
      ) {
        const id = next++;
        this.handlers.set(id, fn);
        return id;
      },
      off(this: { handlers: Map<number, unknown> }, _name: string, id: number) {
        this.handlers.delete(id);
      },
      fire(message: unknown) {
        for (const fn of [...handlers.values()]) fn(message);
      },
    };
  };

  const taken = (token: string, type = 'damage-taken') => ({
    flags: { pf2e: { context: { type } } },
    speaker: { token },
  });

  /** ⛔ Registered at call time, so a message posted immediately after is still seen. */
  it('resolves true when PF2e posts damage-taken for that token', async () => {
    const Hooks = hooksWith();
    const ports = buildApplyPorts({ Hooks, game: { system: { id: 'pf2e' } } } as DeckGlobals, doc);

    const landing = ports.landed('Scene.S1.Token.T1');
    expect(Hooks.handlers.size).toBe(1);
    Hooks.fire(taken('T1'));

    await expect(landing).resolves.toBe(true);
    expect(Hooks.handlers.size).toBe(0);
  });

  it('ignores damage-taken for a different token', async () => {
    vi.useFakeTimers();
    const Hooks = hooksWith();
    const ports = buildApplyPorts(
      { Hooks, game: { system: { id: 'pf2e' } } } as DeckGlobals,
      doc,
      1000
    );

    const landing = ports.landed('Scene.S1.Token.T1');
    Hooks.fire(taken('SOMEONE_ELSE'));
    vi.advanceTimersByTime(1000);

    await expect(landing).resolves.toBe(false);
  });

  /** ⚠️ The namespace is the system's, so SF2e's `flags.sf2e` is read on SF2e. */
  it('reads the flag namespace of the running system', async () => {
    const Hooks = hooksWith();
    const ports = buildApplyPorts({ Hooks, game: { system: { id: 'sf2e' } } } as DeckGlobals, doc);

    const landing = ports.landed('Scene.S1.Token.T1');
    Hooks.fire({
      flags: { sf2e: { context: { type: 'damage-taken' } } },
      speaker: { token: 'T1' },
    });

    await expect(landing).resolves.toBe(true);
  });

  it('resolves false and unhooks when nothing arrives in time', async () => {
    vi.useFakeTimers();
    const Hooks = hooksWith();
    const ports = buildApplyPorts(
      { Hooks, game: { system: { id: 'pf2e' } } } as DeckGlobals,
      doc,
      500
    );

    const landing = ports.landed('Scene.S1.Token.T1');
    vi.advanceTimersByTime(500);

    await expect(landing).resolves.toBe(false);
    expect(Hooks.handlers.size).toBe(0);
  });
});

describe('marking a card handled', () => {
  /** ⛔ `setFlag` writes through the document it is called on; called bare it has no document. */
  it('sets the shared marker by calling setFlag on the message', async () => {
    const written: unknown[] = [];
    const message = {
      id: 'msg1',
      async setFlag(this: { id: string }, scope: string, key: string, value: unknown) {
        written.push([this.id, scope, key, value]);
        return Promise.resolve();
      },
    };
    const messages = {
      get(this: unknown, id: string) {
        return id === 'msg1' ? message : undefined;
      },
    };
    const ports = buildApplyPorts({ game: { messages } }, doc);

    await ports.markHandled('msg1');

    expect(written).toEqual([['msg1', 'tongs-browser', 'handled', true]]);
  });
});
