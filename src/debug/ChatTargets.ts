/**
 * Where a diagnostics report can be sent, read out of Foundry. Extracted from TongsBrowser
 * 2026-08-12.
 *
 * Three separate globals, each of which may be absent, and each absent for a DIFFERENT reason:
 * `ChatMessage` is missing before the world loads, `ui.notifications` is missing on a client that
 * never rendered the interface, and the user id is missing for a session that has not joined. None
 * of them is an error, and the report still has somewhere to go in every case.
 */
export interface ChatTargets {
  /** Foundry's `ChatMessage.create`, or undefined when there is no chat to whisper into. */
  readonly createChatMessage: ((data: unknown) => unknown) | undefined;
  readonly notify: ((message: string) => void) | undefined;
}

export interface ChatGlobals {
  readonly ChatMessage?: { create?: (data: unknown) => unknown };
  readonly ui?: { notifications?: { info?: (message: string) => void } };
}

/**
 * ⚠️ Read as separate optional chains rather than one guard over both.
 *
 * They fail independently: a world can have chat while the notification banner is unavailable, and a
 * client can have notifications up before chat exists. Treating them as one thing means losing the
 * report entirely whenever either is missing, and the whole point of this report is that it reaches
 * somebody holding a phone with no devtools.
 */
export function readChatTargets(globals: ChatGlobals): ChatTargets {
  return {
    createChatMessage: globals.ChatMessage?.create,
    notify: globals.ui?.notifications?.info,
  };
}
