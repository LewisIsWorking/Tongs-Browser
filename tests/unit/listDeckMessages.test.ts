import { describe, expect, it } from 'vitest';

import { listDeckMessages } from '../../src/deck/listDeckMessages.js';
import type { DeckListGlobals, ListedMessage } from '../../src/deck/listDeckMessages.js';

/**
 * The chat log read into deck facts, behind the document boundary. Written 2026-09-13.
 *
 * ⛔ Both filters are asserted in the direction that leaks: a player gets nothing, and a message
 * Foundry has not said is visible never appears, even to a GM.
 */
const TOKEN = 'Scene.S1.Token.T1';

const noSaves = () => [];

const strike = (overrides: Partial<ListedMessage> = {}): ListedMessage => ({
  id: 'm1',
  timestamp: 1000,
  visible: true,
  isDamageRoll: true,
  rolls: [{ total: 6, instances: [{ type: 'fire' }] }],
  flags: { pf2e: { context: { target: { token: TOKEN } } } },
  ...overrides,
});

const globalsWith = (
  messages: readonly ListedMessage[],
  isGM = true,
  fromUuidSync: DeckListGlobals['fromUuidSync'] = (uuid) =>
    uuid === TOKEN ? { name: 'Xorn' } : null
): DeckListGlobals => ({
  game: { user: { isGM }, system: { id: 'pf2e' }, messages: { contents: messages } },
  fromUuidSync,
});

describe('who gets a list', () => {
  it('gives a GM the facts of each message', () => {
    const [facts] = listDeckMessages(globalsWith([strike()]), noSaves);

    expect(facts?.damage).toEqual([
      { rollIndex: 0, total: 6, types: ['fire'], amounts: { full: 6, healing: 6 } },
    ]);
    expect(facts?.target).toEqual({ tokenUuid: TOKEN, name: 'Xorn' });
  });

  /** ⛔ Empty, not filtered: the player's own messages would still name targets. */
  it('gives a player nothing at all', () => {
    expect(listDeckMessages(globalsWith([strike()], false), noSaves)).toEqual([]);
  });

  it('gives nobody anything when there is no game', () => {
    expect(listDeckMessages({}, noSaves)).toEqual([]);
  });
});

describe('which messages are listed', () => {
  it('leaves out a message Foundry says is not visible', () => {
    const whispered = strike({ id: 'hidden', visible: false });

    expect(listDeckMessages(globalsWith([whispered, strike()]), noSaves).map((m) => m.id)).toEqual([
      'm1',
    ]);
  });

  /** ⛔ Fails closed: a message that cannot answer the question is not assumed visible. */
  it('leaves out a message that does not say whether it is visible', () => {
    const silent: ListedMessage = { id: 'm2', timestamp: 1, isDamageRoll: true, rolls: [] };

    expect(listDeckMessages(globalsWith([silent]), noSaves)).toEqual([]);
  });

  it('is empty when the chat log is not there', () => {
    expect(listDeckMessages({ game: { user: { isGM: true } } }, noSaves)).toEqual([]);
  });
});

describe('naming the target', () => {
  it('reads a target Foundry cannot resolve as no target', () => {
    const [facts] = listDeckMessages(
      globalsWith([strike()], true, () => null),
      noSaves
    );

    expect(facts?.target).toBeNull();
  });

  /** ⚠️ Foundry throws on a uuid it cannot parse; one bad message must not empty the deck. */
  it('survives Foundry throwing on a malformed uuid', () => {
    const throwing = () => {
      throw new Error('Invalid UUID');
    };

    const listed = listDeckMessages(globalsWith([strike()], true, throwing), noSaves);

    expect(listed).toHaveLength(1);
    expect(listed[0]?.target).toBeNull();
  });
});
