import type { RecordedMutation } from './shape.ts';

/**
 * The GM roll deck's mutations. Added 2026-09-14.
 *
 * Its own file because the deck's invisible defects are of a third kind: each one still APPLIES damage
 * or ROLLS a save, just to the wrong token, for the wrong viewer, or with nothing to confirm it. Several
 * were measured in a live PF2e before being written down here.
 */
export const DECK_MUTATIONS: readonly RecordedMutation[] = [
  {
    file: 'src/deck/applyThroughSystem.ts',
    find: '    landing = ports.landed(request.targetTokenUuid);\n    entry.onClick(null, listItem);',
    replace:
      '    entry.onClick(null, listItem);\n    landing = ports.landed(request.targetTokenUuid);',
    defect: 'a hit PF2e confirms quickly is reported unconfirmed and its card never drops out',
    tests: ['tests/unit/applyThroughSystem.test.ts'],
  },
  {
    file: 'src/deck/rollSaveThroughSystem.ts',
    find: '    landing = ports.savesLanded(request.tokenUuids);\n    ports.click(control, ports.showsCheckDialogs());',
    replace:
      '    ports.click(control, ports.showsCheckDialogs());\n    landing = ports.savesLanded(request.tokenUuids);',
    defect: 'a save PF2e posts quickly is missed, so a rolled card stays and invites a second roll',
    tests: ['tests/dom/rollSaveThroughSystem.test.ts'],
  },
  {
    file: 'src/deck/rollSaveThroughSystem.ts',
    find: '    detach();\n    restoreSelection(ports.controlled(), previous);',
    replace: '    detach();',
    defect: "rolling a save leaves the enemies selected instead of the GM's own tokens",
    tests: ['tests/dom/rollSaveThroughSystem.test.ts'],
  },
  {
    /*
     * ⛔ MEASURED LIVE, 2026-09-13: an inline check clicked on a detached card rolled nothing, because
     * PF2e listens for it on `document`. The spell button still worked, so half the saves would fail.
     */
    file: 'src/deck/buildSavePorts.ts',
    find: '      doc.body.append(holder);',
    replace: '      void holder;',
    defect: 'rolling an inline @Check save does nothing, while spell saves still work',
    tests: ['tests/dom/buildSavePorts.test.ts'],
  },
  {
    file: 'src/deck/buildSavePorts.ts',
    find: '      return (await message?.renderHTML?.()) ?? null;',
    replace: '      const render = message?.renderHTML;\n      return (await render?.()) ?? null;',
    defect: 'renderHTML is called detached, so rolling any save throws on every real Foundry',
    tests: ['tests/dom/buildSavePorts.test.ts'],
  },
  {
    file: 'src/deck/buildApplyPorts.ts',
    find: '      await message?.setFlag(MODULE_ID, HANDLED_FLAG, true);',
    replace:
      '      const setFlag = message?.setFlag;\n      await setFlag?.(MODULE_ID, HANDLED_FLAG, true);',
    defect: 'setFlag is called detached, so a handled card is never marked and keeps coming back',
    tests: ['tests/unit/buildApplyPorts.test.ts'],
  },
  {
    file: 'src/deck/listDeckMessages.ts',
    find: '    .filter((message) => message.visible === true)',
    replace: '    .filter(() => true)',
    defect: 'the deck lists whispers and blind rolls the viewer was not allowed to see',
    tests: ['tests/unit/listDeckMessages.test.ts'],
  },
  {
    file: 'src/deck/listDeckMessages.ts',
    find: '  if (game?.user?.isGM !== true) {',
    replace: '  if (game === undefined) {',
    defect: "a player's deck lists messages naming targets they may not know",
    tests: ['tests/unit/listDeckMessages.test.ts'],
  },
  {
    file: 'src/deck/RollDeck.ts',
    find: "    if (this.globals.game?.user?.isGM !== true) {\n      return { kind: 'refused', reason: 'only a GM can roll saves from the roll deck' };",
    replace:
      "    if (this.globals.game === undefined) {\n      return { kind: 'refused', reason: 'only a GM can roll saves from the roll deck' };",
    defect: 'a player reaches save rolling, and is refused only by accident further in',
    tests: ['tests/unit/rollDeck.test.ts'],
  },
  {
    file: 'src/deck/readSaveControls.ts',
    find: '      saves.push({ statistic, dc, control, index });',
    replace: '      saves.push({ statistic, dc, control, index: saves.length });',
    defect:
      'on a card with an Athletics check before a Reflex save, rolling the save clicks Athletics',
    tests: ['tests/dom/readSaveControls.test.ts'],
  },
  {
    file: 'src/deck/panel/DeckPanel.ts',
    find: '    if (!this.ports.isGM()) {\n      return;\n    }',
    replace: '    if (this.ports.isGM() === undefined) {\n      return;\n    }',
    defect: 'a player who reaches the open call gets the roll deck on screen',
    tests: ['tests/dom/deckPanel.test.ts', 'tests/dom/buildDeckPanel.test.ts'],
  },
  {
    file: 'src/deck/panel/deckViews.ts',
    find: '  title.textContent = card.title === null ? who : `${who}: ${card.title}`;',
    replace: '  title.innerHTML = card.title === null ? who : `${who}: ${card.title}`;',
    defect: "a player's character name is parsed as HTML in the GM's browser",
    tests: ['tests/dom/deckPanel.test.ts'],
  },
  {
    file: 'src/deck/panel/deckPanelState.ts',
    find: '  return { ...state, cards, index, choosing: same >= 0 ? state.choosing : null };',
    replace: '  return { ...state, cards, index };',
    defect: 'rollers chosen for one card are confirmed against the card that replaced it',
    tests: ['tests/unit/deckPanelState.test.ts'],
  },
  {
    file: 'src/deck/panel/buildDeckPanel.ts',
    find: '      cards: () => deck.cards(),',
    replace: '      cards: deck.cards,',
    defect:
      'the panel reads the deck through a detached method, so it throws on every real Foundry',
    tests: ['tests/dom/buildDeckPanel.test.ts'],
  },
];
