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
  const notifications = globals.ui?.notifications;
  const chatMessage = globals.ChatMessage;

  return {
    /*
     * ⛔ BOUND, fixed 2026-09-12, and it sat one line above the fix explaining exactly why. Handed
     * out detached, `ChatMessage.create` is Foundry's inherited `Document.create`, which begins
     * `this.implementation.createDocuments(...)`; called as `options.createChatMessage(...)` its
     * receiver was `options`, so whispering a diagnostic report threw on every real Foundry.
     *
     * ⛔ The `notify` fix below was made in 2026-09-08 and this line was left beside it. It survived
     * because its test asserted `toBe(create)`, an IDENTITY check that binding would have broken, so
     * the suite held the bug in place rather than missing it.
     */
    createChatMessage: chatMessage?.create?.bind(chatMessage),
    /*
     * ⛔ BOUND, and it took a real party world to find out why. `ui.notifications.info` is a METHOD.
     * Foundry implements it as `info(message, options) { return this.notify(message, "info", options) }`.
     * Handed out detached, it was called as `readChatTargets(globalThis).notify?.(message)`, so
     * `this` became the object literal returned right here.
     *
     * ⛔ That literal HAS a `notify` property, and it is THE SAME FUNCTION. So `this.notify(...)`
     * called `info` again, forever: `RangeError: Maximum call stack size exceeded`, with a stack of
     * nothing but `Object.info [as notify]` and not a single frame of this module in it.
     *
     * ⚠️ The part worth keeping is that losing `this` USUALLY throws at once and obviously. Here the
     * accidental receiver carried a property of exactly the right name, so an ordinary mistake became
     * infinite recursion pointing at Foundry's own source. Measured 2026-09-08 on sf2e: the first
     * world with parties in it was the first to reach this line at all.
     */
    notify: notifications?.info?.bind(notifications),
  };
}
