import { describe, expect, it, vi } from 'vitest';

import { RollDeck } from '../../src/deck/RollDeck.js';
import type { DeckGlobals } from '../../src/deck/buildApplyPorts.js';

/**
 * The roll deck service the module exposes. Written 2026-09-13.
 *
 * ⛔ The gate is asserted by what it does NOT touch: a player's request must be refused before PF2e's
 * context menu is even read, so nothing is selected and nothing is sent.
 */
const doc = { createElement: () => ({ dataset: {} }) } as unknown as Document;

const globalsFor = (isGM: boolean) => {
  const read = vi.fn(() => []);
  const globals: DeckGlobals = {
    game: { user: { isGM } },
    ui: { chat: { _getEntryContextOptions: read } },
  };
  return { globals, read };
};

describe('who may apply damage', () => {
  /** ⛔ Players must never reach this. Refused before anything in Foundry is touched. */
  it('refuses a player without reading PF2e at all', async () => {
    const { globals, read } = globalsFor(false);

    const outcome = await new RollDeck(globals, doc).apply('msg1', 'full', 'Scene.S.Token.T');

    expect(outcome.kind).toBe('refused');
    expect(outcome.kind === 'refused' && outcome.reason).toContain('only a GM');
    expect(read).not.toHaveBeenCalled();
  });

  it('lets a GM through to PF2e', async () => {
    const { globals, read } = globalsFor(true);

    await new RollDeck(globals, doc).apply('msg1', 'full', 'Scene.S.Token.T');

    expect(read).toHaveBeenCalled();
  });
});

describe('the way of applying', () => {
  it('refuses an option that does not exist, naming it', async () => {
    const { globals, read } = globalsFor(true);

    const outcome = await new RollDeck(globals, doc).apply(
      'msg1',
      'quadruple' as 'full',
      'Scene.S.Token.T'
    );

    expect(outcome.kind === 'refused' && outcome.reason).toContain('quadruple');
    expect(read).not.toHaveBeenCalled();
  });
});

describe('the cards', () => {
  const strike = (id: string, timestamp: number) => ({
    id,
    timestamp,
    visible: true,
    isDamageRoll: true,
    rolls: [{ total: 6, instances: [{ type: 'fire' }] }],
  });

  it('lists actionable messages oldest first, for a GM', () => {
    const globals = {
      game: {
        user: { isGM: true },
        system: { id: 'pf2e' },
        messages: { contents: [strike('late', 2000), strike('early', 1000)] },
      },
    };

    expect(new RollDeck(globals, doc).cards().map((card) => card.id)).toEqual(['early', 'late']);
  });

  it('lists nothing for a player', () => {
    const globals = { game: { user: { isGM: false }, messages: { contents: [strike('a', 1)] } } };

    expect(new RollDeck(globals, doc).cards()).toEqual([]);
  });
});

describe('rolling a save', () => {
  /** ⛔ Refused before the chat log is even read. */
  it('refuses a player', async () => {
    const contents = vi.fn(() => []);
    const globals = {
      game: {
        user: { isGM: false },
        messages: {
          get contents() {
            return contents();
          },
        },
      },
    };

    const outcome = await new RollDeck(globals, doc).rollSave('m', 0, ['Scene.S.Token.T']);

    expect(outcome.kind === 'refused' && outcome.reason).toContain('only a GM');
    expect(contents).not.toHaveBeenCalled();
  });

  /** ⚠️ A card handled since it was shown is not rolled a second time. */
  it('refuses a message that is not a current card', async () => {
    const globals = { game: { user: { isGM: true }, messages: { contents: [] } } };

    const outcome = await new RollDeck(globals, doc).rollSave('gone', 0, ['Scene.S.Token.T']);

    expect(outcome.kind === 'refused' && outcome.reason).toContain('handled or no longer');
  });
});
