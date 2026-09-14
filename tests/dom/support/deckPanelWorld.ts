import { vi } from 'vitest';

import type { MessageFacts } from '../../../src/deck/deckFacts.js';
import { DeckPanel } from '../../../src/deck/panel/DeckPanel.js';
import type { DeckPanelPorts } from '../../../src/deck/panel/DeckPanel.js';

/**
 * A deck panel over a fake deck, and ways to drive it by what its buttons SAY. Split from
 * `deckPanel.test.ts` at the 200 line limit, 2026-09-14.
 *
 * ⚠️ The fake deck drops a card once it is applied or rolled, as the real one does through the handled
 * marker, so the panel's move to the next card is exercised rather than assumed.
 */
export const jaws: MessageFacts = {
  id: 'jaws',
  speaker: 'Fire Mephit',
  title: 'Jaws',
  timestamp: 1,
  damage: [
    {
      rollIndex: 0,
      total: 6,
      types: ['piercing', 'fire'],
      amounts: { full: 6, half: 2, double: 12, triple: 18, healing: 6 },
    },
  ],
  saves: [],
  target: { tokenUuid: 'Scene.S.Token.X', name: 'Xorn' },
  handled: false,
};
export const untargeted: MessageFacts = { ...jaws, id: 'loose', target: null };
export const fear: MessageFacts = {
  ...jaws,
  id: 'fear',
  title: 'Fear',
  damage: [],
  saves: [{ statistic: 'will', dc: 17, control: 'spell-save', index: 0 }],
  target: null,
};

export const goblins = [
  { tokenUuid: 'Scene.S.Token.G1', name: 'Goblin', hp: null },
  { tokenUuid: 'Scene.S.Token.G2', name: 'Orc', hp: null },
];

export const panelWith = (cards: MessageFacts[], overrides: Partial<DeckPanelPorts> = {}) => {
  let deckCards = cards;
  const deck = {
    cards: vi.fn(() => deckCards),
    apply: vi.fn(async (id: string) => {
      deckCards = deckCards.filter((card) => card.id !== id);
      return Promise.resolve({ kind: 'applied' as const });
    }),
    rollSave: vi.fn(async (id: string) => {
      deckCards = deckCards.filter((card) => card.id !== id);
      return Promise.resolve({ kind: 'rolled' as const });
    }),
  };
  const panel = new DeckPanel({
    document,
    deck,
    candidates: () => goblins,
    offersTriple: () => false,
    isGM: () => true,
    ...overrides,
  });
  return { panel, deck };
};

export const root = () => document.querySelector<HTMLElement>('.tb-roll-deck');
export const labels = () =>
  [...(root()?.querySelectorAll('button') ?? [])].map((b) => b.textContent);
export const tap = (label: string) => {
  const found = [...(root()?.querySelectorAll('button') ?? [])].find(
    (b) => b.textContent === label
  );
  if (found === undefined) {
    throw new Error(`no button "${label}" in ${JSON.stringify(labels())}`);
  }
  found.click();
};
export const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};
