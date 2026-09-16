import { MODULE_ID } from '../constants.js';
import { parseTokenUuid } from '../deck/buildApplyPorts.js';
import { HANDLED_FLAG } from '../deck/readMessageFacts.js';
import type { RollDeck } from '../deck/RollDeck.js';
import type { AutoApplyPorts } from './AutoApply.js';
import { automationRole } from './automationRole.js';
import type { RoleGlobals } from './automationRole.js';
import { recentStrikeMessages } from './recentStrikeMessages.js';
import type { RecentGlobals } from './recentStrikeMessages.js';
import type { StrikeMessage } from './strikeFacts.js';
import { combatsWithToken } from './tokenCombats.js';
import type { CombatsGlobals } from './tokenCombats.js';

/**
 * The real Foundry behind `AutoApply`. Added 2026-09-14.
 *
 * ⛔ EVERY METHOD IS CALLED ON ITS OBJECT: `message.getFlag`, `strike.damage`, `actors.get`. A detached
 * Foundry method is the bug that twice passed every test and threw in a real game.
 *
 * ⚠️ Globals are read on every call. The active GM, the scene, the combat and the chat log all change
 * while a world runs, and a port built on a snapshot would answer about a world that has moved on.
 */
interface Doc {
  getFlag?(scope: string, key: string): unknown;
  setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
  unsetFlag?(scope: string, key: string): Promise<unknown>;
}

interface StrikeAction {
  damage?(params: object): Promise<unknown>;
  critical?(params: object): Promise<unknown>;
}

interface ActorLike {
  readonly hasPlayerOwner?: boolean;
  readonly system?: {
    readonly actions?: readonly StrikeAction[];
    readonly attributes?: { readonly hp?: { readonly value?: number } };
  };
}

interface TokenDoc {
  readonly actor?: ActorLike | null;
}

export interface AutoGlobals extends RoleGlobals, RecentGlobals {
  readonly game?: RoleGlobals['game'] &
    RecentGlobals['game'] & {
      readonly system?: { readonly id?: string };
      readonly user?: { readonly settings?: { readonly showDamageDialogs?: boolean } };
      readonly messages?: { get?(id: string): (Doc & StrikeMessage) | undefined };
      readonly actors?: { get?(id: string): ActorLike | undefined };
    } & CombatsGlobals['game'];
  /** Foundry's own lookup: a token document on ANY scene, by its uuid. */
  readonly fromUuidSync?: (uuid: string) => unknown;
}

/**
 * ⚠️ The distance options from the player's own damage card. PF2e measures distance between token
 * objects, and a GM viewing another scene has none, so a ranged Aim (`target:range-increment`) would
 * be missing again. Only these are taken: any other option is worked out afresh from the actors.
 */
const CANVAS_OPTION = /^target:(?:distance|range-increment):\d+$/;

function canvasOptions(flags: unknown): string[] {
  const options = (flags as { context?: { options?: unknown } } | undefined)?.context?.options;
  return Array.isArray(options)
    ? options.filter((each): each is string => typeof each === 'string' && CANVAS_OPTION.test(each))
    : [];
}

export function buildAutoApply(globals: AutoGlobals, deck: RollDeck): AutoApplyPorts {
  const doc = (id: string) => globals.game?.messages?.get?.(id);
  const flag = (message: StrikeMessage, key: string) => doc(message.id)?.getFlag?.(MODULE_ID, key);
  const systemId = () => globals.game?.system?.id ?? '';
  const tokenDoc = (uuid: string): TokenDoc | null => {
    try {
      return (globals.fromUuidSync?.(uuid) as TokenDoc | null | undefined) ?? null;
    } catch {
      return null;
    }
  };

  return {
    role: () => automationRole(globals),
    myUserId: () => globals.game?.user?.id ?? null,
    systemId,
    recentMessages: () => recentStrikeMessages(globals),
    flag,
    isHandled: (message) => flag(message, HANDLED_FLAG) === true,
    authorIsPlayer: (message) =>
      (message.author as { isGM?: boolean } | null | undefined)?.isGM === false,
    attackerIsPlayers: (actorId) => globals.game?.actors?.get?.(actorId)?.hasPlayerOwner === true,

    recomputeFormula: async (damage, attackId) => {
      try {
        const strike = globals.game?.actors?.get?.(damage.actorId)?.system?.actions?.[
          damage.strikeIndex
        ];
        const context = (doc(attackId)?.flags?.[systemId()] as { context?: unknown } | undefined)
          ?.context;
        /*
         * ⛔ ALWAYS a target, even an empty one. PF2e reads `(target ?? game.user.targets.first())?.document`,
         * so leaving it out quietly worked the formula out against whatever the GM had targeted. PF2e only
         * reads `.document` off it, so the document on any scene is wrapped rather than a canvas token needed.
         */
        const target = {
          document: damage.targetToken === null ? null : tokenDoc(damage.targetToken),
        };
        /*
         * ⛔ ROLLED, NOT `getFormula`. Found live 2026-09-16 (Diabla's aimed crit on Ovvat): PF2e treats
         * `getFormula` as view only and drops the target, so damage that depends on it (the operative's
         * Aim, `target:mark:aim`) is missing and every aimed hit was declined. A roll with no message
         * resolves the target like the player's roll did (measured: both "2 * (1d4 + 2 + 2d4) cold").
         * The shift key only skips the damage dialog, whichever way this GM has it set.
         */
        const dialogs = globals.game?.user?.settings?.showDamageDialogs;
        const params = {
          createMessage: false,
          target,
          checkContext: context,
          options: canvasOptions(doc(damage.id)?.flags?.[systemId()]),
          event: { shiftKey: dialogs === true, ctrlKey: false, metaKey: false },
        };
        const roll = (
          damage.outcome === 'criticalSuccess'
            ? await strike?.critical?.(params)
            : await strike?.damage?.(params)
        ) as { formula?: unknown } | null | undefined;
        return typeof roll?.formula === 'string' ? roll.formula : null;
      } catch {
        return null;
      }
    },

    targetState: (tokenUuid) => {
      const ids = parseTokenUuid(tokenUuid);
      const token = ids === null ? null : tokenDoc(tokenUuid);
      const hp = token?.actor?.system?.attributes?.hp?.value;
      return {
        exists: Boolean(token?.actor),
        hp: typeof hp === 'number' ? hp : null,
        inCombat: ids !== null && combatsWithToken(globals, ids.sceneId, ids.tokenId).length > 0,
        playerOwned: token?.actor?.hasPlayerOwner === true,
      };
    },

    apply: async (messageId, tokenUuid) => deck.apply(messageId, 'full', tokenUuid),
    setFlag: async (messageId, key, value) => {
      await doc(messageId)?.setFlag?.(MODULE_ID, key, value);
    },
    unsetFlag: async (messageId, key) => {
      await doc(messageId)?.unsetFlag?.(MODULE_ID, key);
    },
  };
}
