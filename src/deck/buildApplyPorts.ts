import { aimAt } from './aimAt.js';
import type { AimableUser } from './aimAt.js';
import type { ApplyPorts, ContextEntry } from './applyThroughSystem.js';
import { HANDLED_FLAG, MODULE_ID } from './readMessageFacts.js';
import { watchMessages } from './watchMessages.js';
import type { HooksLike } from './watchMessages.js';

/**
 * The real Foundry behind `applyThroughSystem`. Added 2026-09-13.
 *
 * ⛔ EVERY METHOD IS CALLED ON ITS OBJECT, and this file is where that is easiest to get wrong. Twice on
 * 2026-09-12 a Foundry method was read off its object and called bare, and both threw on every real
 * Foundry while passing every test: `Actor.create` (#353) and `ChatMessage.create`. Each call below that
 * reads `this` in Foundry is made THROUGH its object, and the tests use fakes that read `this` too:
 *
 * - `ui.chat._getEntryContextOptions()` calls `super` and reads `this`;
 * - `message.setFlag(...)` writes through the document it is called on;
 * - `fromUuidSync` is a global function; `game.user.getActiveTokens` is shadowed ON the user (`aimAt.ts`).
 */
export interface MessageDoc {
  readonly setFlag: (scope: string, key: string, value: unknown) => Promise<unknown>;
  readonly getFlag?: (scope: string, key: string) => unknown;
  /** Foundry's own render, which runs PF2e's `renderChatMessageHTML` listeners onto the element. */
  readonly renderHTML?: () => Promise<HTMLElement>;
}

export interface DeckGlobals {
  readonly ui?: { readonly chat?: { _getEntryContextOptions?: () => readonly ContextEntry[] } };
  /** Foundry's own lookup: a token document on ANY scene of the world, by its uuid. */
  readonly fromUuidSync?: (uuid: string) => unknown;
  readonly game?: {
    readonly user?: AimableUser & {
      readonly isGM?: boolean;
      readonly settings?: { readonly showCheckDialogs?: boolean };
    };
    readonly pf2e?: {
      readonly settings?: { readonly critFumble?: { readonly buttons?: boolean } };
    };
    readonly system?: { readonly id?: string };
    readonly messages?: { get?: (id: string) => MessageDoc | undefined };
  };
  readonly Hooks?: HooksLike;
}

/** `Scene.<scene>.Token.<token>` split into its two ids, or null when it is not that shape. */
export function parseTokenUuid(uuid: string): { sceneId: string; tokenId: string } | null {
  const match = /^Scene\.([^.]+)\.Token\.([^.]+)$/.exec(uuid);
  return match?.[1] !== undefined && match[2] !== undefined
    ? { sceneId: match[1], tokenId: match[2] }
    : null;
}

export function buildApplyPorts(
  globals: DeckGlobals,
  doc: Document,
  landedTimeoutMs = 10_000
): ApplyPorts {
  const systemId = globals.game?.system?.id ?? '';

  return {
    contextEntries: () => globals.ui?.chat?._getEntryContextOptions?.() ?? [],

    /*
     * ⚠️ ANY SCENE, since 2026-09-15: PF2e is aimed at the document, not a controlled token (`aimAt.ts`).
     * Only a scene token counts, and only one with an actor: a token whose actor was deleted takes no hit.
     */
    tokenFor: (tokenUuid) => {
      if (parseTokenUuid(tokenUuid) === null) {
        return null;
      }
      try {
        const found = globals.fromUuidSync?.(tokenUuid) as
          { readonly actor?: unknown } | null | undefined;
        return found?.actor ? found : null;
      } catch {
        return null;
      }
    },
    canAim: () => globals.game?.user !== undefined,
    aimAt: (tokens, click) => {
      const user = globals.game?.user;
      if (user !== undefined) {
        aimAt(user, tokens, click);
      }
    },
    offersTriple: () => globals.game?.pf2e?.settings?.critFumble?.buttons === true,

    /* PF2e's `onClick` reads `li.dataset.messageId` and nothing else from the element. */
    listItemFor: (messageId) => {
      const item = doc.createElement('li');
      item.dataset['messageId'] = messageId;
      return item;
    },

    /* ⛔ Watched synchronously; see `watchMessages`. `applyThroughSystem` arms this BEFORE clicking. */
    landed: async (tokenUuid) => {
      const tokenId = parseTokenUuid(tokenUuid)?.tokenId;
      return watchMessages(globals.Hooks, {
        systemId,
        type: 'damage-taken',
        tokenIds: tokenId === undefined ? [] : [tokenId],
        timeoutMs: landedTimeoutMs,
      });
    },

    markHandled: async (messageId) => {
      const message = globals.game?.messages?.get?.(messageId);
      await message?.setFlag(MODULE_ID, HANDLED_FLAG, true);
    },
  };
}
