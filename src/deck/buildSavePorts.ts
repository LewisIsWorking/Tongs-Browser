import { buildApplyPorts, parseTokenUuid } from './buildApplyPorts.js';
import type { DeckGlobals } from './buildApplyPorts.js';
import type { SavePorts } from './rollSaveThroughSystem.js';
import { watchMessages } from './watchMessages.js';

/**
 * The real Foundry behind `rollSaveThroughSystem`. Added 2026-09-13.
 *
 * ⚠️ Built on `buildApplyPorts` for what the two share (aiming, finding a token on any scene, the
 * handled marker), so `setFlag` is called on its message in ONE place rather than two.
 *
 * ⛔ EVERY METHOD IS CALLED ON ITS OBJECT, for the reason written at the top of `buildApplyPorts`:
 * `message.renderHTML()` reads `this`, and a detached call throws only in a real Foundry.
 */
export function buildSavePorts(
  globals: DeckGlobals,
  doc: Document,
  landedTimeoutMs = 10_000
): SavePorts {
  const shared = buildApplyPorts(globals, doc, landedTimeoutMs);

  return {
    tokenFor: shared.tokenFor,
    canAim: shared.canAim,
    aimAt: shared.aimAt,
    markHandled: shared.markHandled,

    renderCard: async (messageId) => {
      const message = globals.game?.messages?.get?.(messageId);
      return (await message?.renderHTML?.()) ?? null;
    },

    /*
     * ⚠️ Marked as this module's own, so the gesture layer keeps away from it for the moment it exists.
     * `hidden` keeps it off screen; a click dispatched on a hidden element still bubbles to `document`,
     * which is the whole reason it is attached.
     */
    attachHidden: (card) => {
      const holder = doc.createElement('div');
      holder.hidden = true;
      holder.setAttribute('data-tongs-browser', 'ignore');
      holder.append(card);
      doc.body.append(holder);
      return () => {
        holder.remove();
      };
    },

    click: (control, shiftKey) => {
      control.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey }));
    },

    showsCheckDialogs: () => globals.game?.user?.settings?.showCheckDialogs === true,

    savesLanded: async (tokenUuids) => {
      const tokenIds = tokenUuids.map((uuid) => parseTokenUuid(uuid)?.tokenId);
      return watchMessages(globals.Hooks, {
        systemId: globals.game?.system?.id ?? '',
        type: 'saving-throw',
        /* ⚠️ An unparseable uuid empties the list, which watches for nothing and reads as false. */
        tokenIds: tokenIds.every((id) => id !== undefined) ? tokenIds : [],
        timeoutMs: landedTimeoutMs,
      });
    },
  };
}
