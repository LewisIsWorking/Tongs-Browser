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
