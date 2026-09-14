import { describe, expect, it } from 'vitest';

import { RollDeck } from '../../src/deck/RollDeck.js';
import type { RollDeckGlobals } from '../../src/deck/RollDeck.js';
import type { CreatedMessage } from '../../src/deck/watchMessages.js';

/**
 * One hit is applied once, whoever asks first. Written 2026-09-14 with phase 2.
 *
 * ⛔ The race this closes: the automation and the GM's own tap both call `RollDeck.apply`, and the
 * handled marker is only written once PF2e confirms the damage landed. These fakes let the test hold
 * PF2e's confirmation back, so the second request arrives exactly in that gap.
 *
 * ⚠️ Fakes read `this`, like every Foundry fake in the deck's tests.
 */
const doc = {
  createElement: () => ({ dataset: {} as Record<string, string> }),
} as unknown as Document;

const world = () => {
  const handlers = new Map<number, (message: CreatedMessage) => void>();
  const flags = new Map<string, unknown>();
  const clicks: string[] = [];
  const token = {
    control: () => undefined,
    release: () => undefined,
  };
  const message = {
    async setFlag(this: unknown, scope: string, key: string, value: unknown) {
      flags.set(`${scope}.${key}`, value);
      return Promise.resolve();
    },
    getFlag(this: unknown, scope: string, key: string) {
      return flags.get(`${scope}.${key}`);
    },
  };
  const globals: RollDeckGlobals = {
    game: {
      user: { isGM: true },
      system: { id: 'pf2e' },
      messages: {
        get(this: unknown, id: string) {
          return id === 'm1' ? message : undefined;
        },
      },
    },
    ui: {
      chat: {
        _getEntryContextOptions(this: unknown) {
          return [
            {
              label: 'PF2E.DamageButton.FullContext',
              onClick: (_event: Event | null, li: HTMLElement) => {
                clicks.push(li.dataset['messageId'] ?? '');
              },
            },
          ];
        },
      },
    },
    canvas: {
      scene: { id: 'S1' },
      tokens: {
        controlled: [],
        get(this: unknown, id: string) {
          return id === 'T1' ? token : undefined;
        },
      },
    },
    Hooks: {
      on(this: unknown, _name: string, fn: (message: CreatedMessage) => void) {
        handlers.set(handlers.size + 1, fn);
        return handlers.size;
      },
      off(this: unknown, _name: string, id: number) {
        handlers.delete(id);
      },
    },
  };
  const land = () => {
    for (const fn of [...handlers.values()]) {
      fn({ flags: { pf2e: { context: { type: 'damage-taken' } } }, speaker: { token: 'T1' } });
    }
  };
  return { globals, clicks, land };
};

describe('applying one card twice', () => {
  it('refuses a second request while the first is waiting for PF2e, then refuses once handled', async () => {
    const { globals, clicks, land } = world();
    const deck = new RollDeck(globals, doc);

    const first = deck.apply('m1', 'full', 'Scene.S1.Token.T1');
    const second = await deck.apply('m1', 'full', 'Scene.S1.Token.T1');
    expect(second).toEqual({ kind: 'refused', reason: 'that card is already being handled' });

    land();
    expect(await first).toEqual({ kind: 'applied' });

    const third = await deck.apply('m1', 'full', 'Scene.S1.Token.T1');
    expect(third).toEqual({ kind: 'refused', reason: 'that card has already been handled' });
    expect(clicks).toEqual(['m1']);
  });

  it('lets the card be tried again after an attempt that did not land', async () => {
    const { globals, clicks } = world();
    const deck = new RollDeck(globals, doc);
    Object.assign(globals.canvas?.tokens ?? {}, {
      get: () => undefined,
    });

    const gone = await deck.apply('m1', 'full', 'Scene.S1.Token.T1');
    const again = await deck.apply('m1', 'full', 'Scene.S1.Token.T1');

    expect(gone.kind).toBe('refused');
    expect(again.kind === 'refused' && again.reason).toContain('no longer on the scene');
    expect(clicks).toEqual([]);
  });

  it('applies a card by groups under the same guard, for a GM, with known options only', async () => {
    const { globals, clicks, land } = world();
    const deck = new RollDeck(globals, doc);
    const groups = [{ optionId: 'full' as const, targetTokenUuids: ['Scene.S1.Token.T1'] }];

    expect(
      await deck.applyGroups('m1', [{ optionId: 'nope' as 'full', targetTokenUuids: [] }])
    ).toEqual({
      kind: 'refused',
      reason: 'there is no way to apply damage called "nope"',
    });
    const first = deck.applyGroups('m1', groups);
    expect((await deck.applyGroups('m1', groups)).kind).toBe('refused');
    land();
    expect(await first).toEqual({ kind: 'applied' });
    expect(clicks).toEqual(['m1']);

    Object.assign(globals.game?.user ?? {}, { isGM: false });
    expect(await deck.applyGroups('m1', groups)).toEqual({
      kind: 'refused',
      reason: 'only a GM can apply damage from the roll deck',
    });
  });
});
