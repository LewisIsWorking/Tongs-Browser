# src/deck/panel

The GM roll deck on screen: one card at a time, big buttons, Previous and Next. GM only.

| File                 | What it is                                                             |
| -------------------- | ---------------------------------------------------------------------- |
| `DeckPanel.ts`       | The panel's lifecycle: open, close, re-render, and sending to the deck |
| `deckBody.ts`        | The card on screen, or the choice the GM is part way through for it    |
| `deckViews.ts`       | The card and picker elements, built from text only                     |
| `deckPanelState.ts`  | Where the GM is in the deck, as pure data                              |
| `deckLabels.ts`      | What the save and navigation buttons say                               |
| `tokenCandidates.ts` | The tokens a GM can choose when a card names nobody                    |
| `buildDeckPanel.ts`  | The real Foundry behind the panel, and the one place the deck is built |

## Rules this folder keeps

- **Our own interface.** The panel root carries `data-tongs-browser="ignore"`, which makes the gesture
  layer keep away and stops PIXI seeing taps on it. It shows chat content but is not the chat log.
- **Every button names what it does**: "Apply 6 piercing and fire to Xorn", "Roll Will DC 17 for
  Goblin and Orc". On a phone there is no hover to check first.
- **Text only.** Speakers and item names come from players; nothing is ever set as HTML.
- **No target means the GM chooses.** From the running encounter on this scene, else every token on it.
- **Swipe comes later.** Buttons first, because a gesture that half works cannot tell you what you did
  wrong.
