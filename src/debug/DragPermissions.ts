/**
 * What Foundry's own permission checks say about dragging this token. Extracted from
 * FoundryProbes 2026-08-13.
 *
 * Its own file because asking a permission here is not a read: `_canDragLeftStart` WARNS THE USER
 * unless told not to, so this is the one probe in the set with a side effect to suppress, and that
 * is worth having somewhere it cannot be overlooked.
 *
 * ⚠️ `#handleDragStart` is the ONE cancel path that fires on something other than a pointerup:
 *
 *     if ( !this.can(action, event) ) {
 *       this.#debug(action, event, this.handlerOutcomes.DISALLOWED);
 *       this.cancel(event);
 *       return;
 *     }
 *
 * So a refused `dragLeftStart` cancels the whole interaction, and nothing else in the report would
 * say so: the state, the gate and the origin all look exactly as they do for any other cancel. This
 * asks the manager directly rather than inferring it from a stack frame.
 *
 * `dragStart` is asked as well, because it gates a DIFFERENT thing: `#handleClickLeft` only reaches
 * GRABBED and binds the drag handlers when `can("dragStart")` passes. One false and the other true
 * are two different failures.
 */
export function describeDragPermissions(target: unknown): string {
  const manager = (
    target as { mouseInteractionManager?: { can?: (a: string, e: unknown) => boolean } } | undefined
  )?.mouseInteractionManager;
  const can = manager?.can;
  if (can === undefined) {
    return 'no manager to ask';
  }

  /*
   * A bare object rather than a real event, plus the ONE field a permission check was measured to
   * read. `_canDragLeftStart` does `event.interactionData.object?.mouseInteractionManager`, and a
   * device reported `unaskable(Cannot read properties of undefined (reading 'object'))`, which named
   * the field precisely.
   *
   * ⚠️ An EMPTY interactionData is the honest value, not a populated one. It says "nothing is being
   * previewed", which is the truth while a report is being assembled. Filling it with a plausible
   * object would make the check answer a question about a drag that is not happening.
   */
  const probe = { type: 'pointermove', button: 0, interactionData: {} };
  const answers = ['clickLeft', 'dragStart', 'dragLeftStart'].map((action) => {
    try {
      /*
       * ⚠️ `dragLeftStart` is asked THROUGH THE OBJECT rather than through `can`, and only because
       * asking the obvious way has a side effect. `_canDragLeftStart(user, event, {notify})` warns
       * the user by default, and `can` gives no way to pass `notify: false`, so a refusal would pop
       * a toast on the player's screen every time they pressed the diagnose button. A diagnostic
       * that changes what the user sees is not reporting on the session any more, it is part of it.
       */
      if (action === 'dragLeftStart') {
        return `${action}=${String(askDragLeftStart(target, probe))}`;
      }
      return `${action}=${String(can.call(manager, action, probe))}`;
    } catch (error) {
      /*
       * ⚠️ The MESSAGE, not the bare word `unaskable`, and the difference cost a device round trip.
       *
       * `dragLeftStart=unaskable` was reported by a phone and said only "the probe threw", which is
       * the one thing already obvious from the word. The message names the field the check read and
       * this probe did not supply, which is the actual answer.
       *
       * Deliberately NOT fixed by enriching the probe until that message says what to enrich it
       * with. Adding fields to make a probe stop throwing is how a probe starts reporting healthy
       * every time, and a permission check that answers the wrong question is worse than one that
       * refuses to answer.
       */
      const message = error instanceof Error ? error.message : String(error);
      return `${action}=unaskable(${message.slice(0, 60)})`;
    }
  });
  return answers.join(' ');
}

/**
 * Ask a placeable directly whether it would allow a left drag to start, without warning the user.
 *
 * ⚠️ Silent by construction. Foundry's own signature is
 * `_canDragLeftStart(user, event, {notify=true}={})`, and every refusal path inside it calls
 * `ui.notifications.warn` when `notify` is left alone. `MouseInteractionManager#can` has no way to
 * pass that through, so the only silent route is the object's own method.
 */
function askDragLeftStart(target: unknown, probe: unknown): boolean {
  const placeable = target as
    | {
        _canDragLeftStart?: (
          user: unknown,
          event: unknown,
          options: { notify: boolean }
        ) => boolean;
      }
    | undefined;
  const ask = placeable?._canDragLeftStart;
  if (typeof ask !== 'function') {
    throw new Error('no _canDragLeftStart on the placeable');
  }
  const user = (globalThis as { game?: { user?: unknown } }).game?.user;
  return ask.call(placeable, user, probe, { notify: false });
}
