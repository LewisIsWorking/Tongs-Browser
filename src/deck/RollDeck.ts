import { APPLY_OPTIONS } from './applyOptions.js';
import type { ApplyOption } from './applyOptions.js';
import { applyThroughSystem } from './applyThroughSystem.js';
import type { ApplyOutcome } from './applyThroughSystem.js';
import { buildApplyPorts } from './buildApplyPorts.js';
import type { DeckGlobals } from './buildApplyPorts.js';
import { buildDeck } from './buildDeck.js';
import type { MessageFacts } from './deckFacts.js';
import { listDeckMessages } from './listDeckMessages.js';
import type { DeckListGlobals } from './listDeckMessages.js';

/** Everything the deck reads from Foundry: what applying needs and what listing needs. */
export type RollDeckGlobals = DeckGlobals & DeckListGlobals;

/**
 * The GM roll deck as one service the module exposes. Added 2026-09-13.
 *
 * ⚠️ Reached as `game.modules.get('tongs-browser').api.getDeck()`, the same way the live harnesses
 * already reach `getPointer()`. `api` IS the module instance and several harnesses call its methods
 * directly, so the deck is a member of it rather than a replacement for it.
 *
 * ⛔ GM ONLY, checked here before anything is sent. Foundry would refuse a player's damage to an enemy
 * anyway, but the brief is explicit that players must never be able to reach this view, and a refusal
 * that names the reason is better than PF2e's own error arriving on a player's phone.
 */
export class RollDeck {
  private readonly globals: RollDeckGlobals;
  private readonly doc: Document;

  public constructor(globals: RollDeckGlobals, doc: Document) {
    this.globals = globals;
    this.doc = doc;
  }

  /**
   * The cards to show, oldest unhandled first. Read fresh on every call, since the chat log keeps
   * growing while the deck is open. Empty for anyone who is not a GM; see `listDeckMessages`.
   */
  public cards(): MessageFacts[] {
    return buildDeck(listDeckMessages(this.globals));
  }

  public async apply(
    messageId: string,
    optionId: ApplyOption['id'],
    targetTokenUuid: string
  ): Promise<ApplyOutcome> {
    if (this.globals.game?.user?.isGM !== true) {
      return { kind: 'refused', reason: 'only a GM can apply damage from the roll deck' };
    }

    const option = APPLY_OPTIONS.find((each) => each.id === optionId);
    if (option === undefined) {
      return { kind: 'refused', reason: `there is no way to apply damage called "${optionId}"` };
    }

    return applyThroughSystem(buildApplyPorts(this.globals, this.doc), {
      messageId,
      option,
      targetTokenUuid,
    });
  }
}
