/**
 * Waiting for PF2e to report, per token, that what the deck asked for happened. Added 2026-09-13.
 *
 * Extracted from `buildApplyPorts` when saves arrived, because both confirm the same way: PF2e runs its
 * own code, returns nothing to await, and later posts a chat message about each token. Applying waits
 * for one `damage-taken`; rolling saves waits for a `saving-throw` from every token that was asked.
 *
 * Measured 2026-09-13 on pf2e 8.5.0: a save rolled from a spell card and one rolled from an inline
 * check both posted `flags.pf2e.context.type === "saving-throw"` with `speaker.token` the rolling
 * token's id.
 */
export interface CreatedMessage {
  readonly flags?: Readonly<Record<string, { readonly context?: { readonly type?: string } }>>;
  readonly speaker?: { readonly token?: string | null };
}

export interface HooksLike {
  on: (name: string, fn: (message: CreatedMessage) => void) => number;
  off: (name: string, id: number) => void;
}

export interface MessageWatch {
  /** `game.system.id`, whose flag namespace the message is read from. */
  readonly systemId: string;
  /** PF2e's `context.type`, such as `damage-taken` or `saving-throw`. */
  readonly type: string;
  /** Token ids, not UUIDs: `speaker.token` is the bare id. */
  readonly tokenIds: readonly string[];
  readonly timeoutMs: number;
}

/**
 * Resolves true once a message of the type has arrived for EVERY token, false on timeout.
 *
 * ⛔ THE HOOK IS REGISTERED SYNCHRONOUSLY, inside the executor, so it is live the moment this is called.
 * Callers watch BEFORE they click, and a version that registered after an `await` would miss a message
 * PF2e posts quickly.
 *
 * ⚠️ No hooks, or no tokens to wait for, is false at once. Nothing could ever confirm it, and an empty
 * list must not read as "everyone rolled".
 */
export async function watchMessages(
  hooks: HooksLike | undefined,
  watch: MessageWatch
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (hooks === undefined || watch.tokenIds.length === 0) {
      resolve(false);
      return;
    }
    const live = hooks;
    const waiting = new Set(watch.tokenIds);
    const hookId = live.on('createChatMessage', (message) => {
      const token = message.speaker?.token;
      if (
        message.flags?.[watch.systemId]?.context?.type === watch.type &&
        typeof token === 'string'
      ) {
        waiting.delete(token);
        if (waiting.size === 0) {
          finish(true);
        }
      }
    });
    const timer = setTimeout(() => {
      finish(false);
    }, watch.timeoutMs);

    /*
     * ⚠️ One `finish`, so arriving and timing out can never both unhook or both resolve. Declared last
     * and hoisted: it only ever runs from the hook or the timer, both of which fire after `hookId` and
     * `timer` exist, so neither needs an "is it set yet" branch that nothing could reach.
     */
    function finish(arrived: boolean): void {
      live.off('createChatMessage', hookId);
      clearTimeout(timer);
      resolve(arrived);
    }
  });
}
