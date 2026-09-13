import type { ApplyPorts, ContextEntry, TokenLike } from './applyThroughSystem.js';
import { HANDLED_FLAG, MODULE_ID } from './readMessageFacts.js';

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
 * - `canvas.tokens.get(...)` is a collection method.
 */
interface MessageDoc {
  readonly setFlag: (scope: string, key: string, value: unknown) => Promise<unknown>;
}

interface CreatedMessage {
  readonly flags?: Readonly<Record<string, { readonly context?: { readonly type?: string } }>>;
  readonly speaker?: { readonly token?: string | null };
}

export interface DeckGlobals {
  readonly ui?: { readonly chat?: { _getEntryContextOptions?: () => readonly ContextEntry[] } };
  readonly canvas?: {
    readonly scene?: { readonly id?: string } | null;
    readonly tokens?: {
      readonly controlled?: readonly TokenLike[];
      get?: (id: string) => TokenLike | undefined;
    };
  };
  readonly game?: {
    readonly system?: { readonly id?: string };
    readonly messages?: { get?: (id: string) => MessageDoc | undefined };
  };
  readonly Hooks?: {
    on: (name: string, fn: (message: CreatedMessage) => void) => number;
    off: (name: string, id: number) => void;
  };
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
    controlled: () => globals.canvas?.tokens?.controlled ?? [],

    /*
     * ⚠️ A token on ANOTHER scene is treated as gone. PF2e applies to controlled tokens, which only
     * exist on the scene being viewed, so a target recorded on a different scene cannot be selected and
     * must not be reported as a success.
     */
    tokenFor: (tokenUuid) => {
      const ids = parseTokenUuid(tokenUuid);
      if (ids === null || globals.canvas?.scene?.id !== ids.sceneId) {
        return null;
      }
      return globals.canvas.tokens?.get?.(ids.tokenId) ?? null;
    },

    /* PF2e's `onClick` reads `li.dataset.messageId` and nothing else from the element. */
    listItemFor: (messageId) => {
      const item = doc.createElement('li');
      item.dataset['messageId'] = messageId;
      return item;
    },

    /*
     * ⛔ The hook is registered INSIDE the executor, so it is live the moment `landed` is called, which
     * is before the click. `applyThroughSystem` relies on that ordering, and a version that registered
     * after an `await` would miss a fast `damage-taken` message.
     */
    landed: async (tokenUuid) =>
      new Promise<boolean>((resolve) => {
        const hooks = globals.Hooks;
        const tokenId = parseTokenUuid(tokenUuid)?.tokenId;
        if (hooks === undefined || tokenId === undefined) {
          resolve(false);
          return;
        }
        /* ⚠️ One `finish`, so the landing and the timeout can never both unhook or both resolve. */
        const watch: { hookId?: number; timer?: ReturnType<typeof setTimeout> } = {};
        const finish = (landed: boolean): void => {
          if (watch.hookId !== undefined) {
            hooks.off('createChatMessage', watch.hookId);
          }
          clearTimeout(watch.timer);
          resolve(landed);
        };
        watch.hookId = hooks.on('createChatMessage', (message) => {
          const type = message.flags?.[systemId]?.context?.type;
          if (type === 'damage-taken' && message.speaker?.token === tokenId) {
            finish(true);
          }
        });
        watch.timer = setTimeout(() => {
          finish(false);
        }, landedTimeoutMs);
      }),

    markHandled: async (messageId) => {
      const message = globals.game?.messages?.get?.(messageId);
      await message?.setFlag(MODULE_ID, HANDLED_FLAG, true);
    },
  };
}
