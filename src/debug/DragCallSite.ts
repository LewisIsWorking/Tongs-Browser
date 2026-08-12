/**
 * Naming WHAT ended a drag and WHERE from. Extracted from FoundryDragHooks 2026-08-12.
 *
 * Extracted because that file crossed the 200 line limit, and because these two are the only part
 * of the drag hooks with a judgement in them rather than a wrap. Both answer a question the raw
 * observation cannot: the event alone cannot say which of Foundry's several cancel paths fired, and
 * the state alone cannot say what event, if any, was responsible.
 */

/** Foundry's MouseInteractionManager states, by index. Matches INTERACTION_STATES in Foundry 14. */
export const STATE_NAMES = ['NONE', 'HOVER', 'CLICKED', 'GRABBED', 'DRAG', 'DROP'];

/** Describe the event that caused an ending, or say plainly that there was not one. */
export function describeCause(event: unknown): string {
  const detail = event as { type?: string; button?: number; pointerType?: string } | undefined;
  if (detail?.type === undefined) {
    return 'no event, Foundry did it itself';
  }
  return `${detail.type} button=${String(detail.button)} ${detail.pointerType ?? 'n/a'}`;
}

/**
 * WHICH of Foundry's cancel sites fired, named from the call stack.
 *
 * ⚠️ The event alone cannot answer this, and three rounds of diagnosis assumed it could. Foundry has
 * several paths into `cancel`, and one of them is a long press TIMEOUT whose closure still holds the
 * original `pointerdown`. So a cancel stamped `pointerdown` may have happened half a second after
 * that pointerdown, from a timer, and reading the event as "the pointerdown caused it" is wrong in a
 * way nothing in the report contradicts.
 *
 * The frames are Foundry's own, which is the point: `#handleDragStart` refusing at
 * `can("dragLeftStart")`, `#handleDragCancel` from a pointerup, and the long press are three
 * different bugs with three different fixes, and they are indistinguishable without this.
 */
export function describeCallSite(): string {
  const frames = (new Error('cancel').stack ?? '').split(String.fromCharCode(10)).slice(1);

  /*
   * ⚠️ Filtered by the BUNDLE URL, not by source file names, and the difference is why two releases
   * of this reported nothing useful.
   *
   * After bundling there is no `FoundryDragHooks.ts` in a stack: every frame from this module says
   * `tongs-browser`. Filtering on the source name matched nothing, so the fallback happily reported
   * `at describeCallSite (...)`, which is this function naming itself.
   */
  const theirs = frames.filter((frame) => !frame.includes('tongs-browser'));

  /*
   * ⚠️ THREE frames, not one, and one frame was never going to be enough. The first Foundry frame is
   * usually `MouseInteractionManager.callback`, which says only "a placeable's handler did it" and
   * not WHICH handler: `_onClickLeft` closing the HUD, a redraw, and a refused permission all arrive
   * through `callback`. The caller is the answer, and it is one frame further up.
   */
  const named = theirs.slice(0, 3).map((frame) => {
    const match = /at ([\w#.<>$]+)/.exec(frame.trim());
    return match?.[1] ?? frame.trim().slice(0, 40);
  });
  return named.length === 0 ? 'unknown caller' : named.join(' < ');
}
