/**
 * Watches how Foundry ends a token drag. Extracted from TongsBrowser 2026-08-12.
 *
 * Extracted because the composition root had reached 1,853 lines against a hard 200 line limit, and
 * because this is the one part of the diagnostics with real logic in it rather than formatting.
 *
 * Every wrap here calls the original with the original `this` and returns its result untouched, so
 * this observes Foundry without changing it. That is not a nicety: a probe that alters the thing it
 * measures would be worse than no probe, and this one is installed inside a live game.
 */

/** Foundry's MouseInteractionManager states, by index. Matches INTERACTION_STATES in Foundry 14. */
const STATE_NAMES = ['NONE', 'HOVER', 'CLICKED', 'GRABBED', 'DRAG', 'DROP'];

/** The shape of a wrappable prototype: a bag of methods, which is all this needs. */
type Prototype = Record<string, unknown>;

export interface FoundryDragHookOptions {
  /** Foundry's Token object class prototype, or undefined before the canvas exists. */
  readonly getTokenPrototype: () => Prototype | undefined;
  /** The interaction manager prototype, reached through a live token. */
  readonly getManagerPrototype: () => Prototype | undefined;
  /** Whether a drag is being recorded right now, so redraws outside one are ignored. */
  readonly isRecording: () => boolean;
  /** Called with each observation, in the order it happened. */
  readonly onObservation: (note: string) => void;
}

/** Describe the event that caused an ending, or say plainly that there was not one. */
function describeCause(event: unknown): string {
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
function describeCallSite(): string {
  const frames = (new Error('cancel').stack ?? '').split(String.fromCharCode(10)).slice(1);
  /*
   * ⚠️ OUR OWN wrapper is excluded first, and leaving it in made the whole thing useless.
   *
   * The wrapper is assigned onto `MouseInteractionManager.prototype`, so its stack frame reads
   * `MouseInteractionManager.wrapped` and matched the search before any real frame did. The report
   * then said `via MouseInteractionManager.wrapped`, which is the observer naming itself.
   */
  const theirs = frames.filter(
    (frame) => !frame.includes('wrapped') && !frame.includes('FoundryDragHooks')
  );
  const foundry = theirs.find(
    (frame) => frame.includes('mouse-handler') || frame.includes('MouseInteractionManager')
  );
  if (foundry === undefined) {
    /*
     * ⚠️ Skip OUR OWN frames. The wrapper that records this is itself on the stack, and naming it
     * says only "the observer observed", which is exactly the kind of true and useless line this
     * report has too many of already.
     */
    return theirs[0]?.trim().slice(0, 60) ?? 'unknown caller';
  }
  const named = /at ([\w#.<>]+)/.exec(foundry.trim());
  return named?.[1] ?? foundry.trim().slice(0, 60);
}

/** What actually got hooked, so silence can be told apart from not watching. */
export interface InstalledHooks {
  readonly token: boolean;
  readonly manager: boolean;
}

/**
 * Install the observers, once.
 *
 * ⚠️ Returns WHICH prototypes were hooked, not merely whether to stop retrying. A device reported
 * "NOTHING observed" while the drag origin was demonstrably being wiped, and those two facts cannot
 * both be true of a watched drag. They are trivially both true of an UNWATCHED one, and nothing in
 * the report said which it was. A probe whose silence is unfalsifiable is not a probe.
 *
 * The manager prototype is reached through a live controlled token, so it can genuinely be missing
 * while the token class is present. That is a normal state, not an error, and it has to be visible
 * rather than inferred.
 */
export function installFoundryDragHooks(options: FoundryDragHookOptions): InstalledHooks {
  const tokenPrototype = options.getTokenPrototype();
  if (tokenPrototype === undefined) {
    return { token: false, manager: false };
  }

  const manager = hookManager(options);
  hookRedraws(tokenPrototype, options);
  hookEndings(tokenPrototype, options);
  return { token: true, manager };
}

/**
 * ⚠️ The MANAGER, not just the token, because the token's callbacks have a blind spot.
 *
 * From Foundry's `cancel()`:
 *
 *     if ( endState <= this.states.HOVER ) return ...SKIPPED
 *     if ( endState >= this.states.DRAG ) { this.callback(action, event) ... }
 *
 * The cancel callback only fires once the state has reached DRAG. A cancel arriving at GRABBED
 * resets the interaction and calls nothing at all, so watching only the token's callbacks reports
 * "neither ending ran" while the drag is being destroyed in front of it. `reset()` sets
 * `interactionData = {}`, which is why the drag origin kept vanishing between samples.
 */
function hookManager(options: FoundryDragHookOptions): boolean {
  const managerPrototype = options.getManagerPrototype();
  if (managerPrototype === undefined) {
    return false;
  }

  for (const name of ['cancel', 'reset']) {
    const original = managerPrototype[name];
    if (typeof original !== 'function') {
      continue;
    }
    managerPrototype[name] = function wrapped(this: { state?: unknown }, ...args: unknown[]) {
      const state = STATE_NAMES[this.state as number] ?? String(this.state);
      const via = name === 'cancel' ? ` via ${describeCallSite()}` : '';
      options.onObservation(`manager.${name} at ${state}${via} [${describeCause(args[0])}]`);
      return (original as (...inner: unknown[]) => unknown).apply(this, args);
    };
  }
  return true;
}

/**
 * ⚠️ REDRAWING A TOKEN CANCELS ITS INTERACTION. From Foundry's PlaceableObject, in both methods:
 *
 *     if ( this.mouseInteractionManager?.state > INTERACTION_STATES.HOVER ) {
 *       this.mouseInteractionManager.interactionData.cancelled = true;
 *       this.mouseInteractionManager.cancel();
 *     }
 *
 * So anything redrawing the token mid gesture destroys the drag, at GRABBED, silently. A phone has
 * redraw causes a desktop does not: Foundry redraws on canvas resize, and on Android the URL bar
 * sliding in and out during a gesture resizes the viewport.
 */
function hookRedraws(prototype: Prototype, options: FoundryDragHookOptions): void {
  for (const name of ['draw', 'destroy']) {
    const original = prototype[name];
    if (typeof original !== 'function') {
      continue;
    }
    prototype[name] = function wrapped(this: unknown, ...args: unknown[]) {
      if (options.isRecording()) {
        options.onObservation(`token.${name} DURING THE DRAG (this cancels the interaction)`);
      }
      return (original as (...inner: unknown[]) => unknown).apply(this, args);
    };
  }
}

/**
 * The token's own drag callbacks, which say what Foundry decided once it reached DRAG.
 *
 * `_onDragLeftDrop` reads the clones and writes the new position; `_onDragLeftCancel` destroys the
 * preview and writes nothing. From outside they are identical: both reset the state, both clear the
 * preview, and both leave the token exactly where it was.
 */
function hookEndings(prototype: Prototype, options: FoundryDragHookOptions): void {
  for (const name of ['_onDragLeftStart', '_onDragLeftDrop', '_onDragLeftCancel']) {
    const original = prototype[name];
    if (typeof original !== 'function') {
      continue;
    }
    prototype[name] = function wrapped(this: unknown, ...args: unknown[]) {
      options.onObservation(`${name} [${describeCause(args[0])}]`);
      return (original as (...inner: unknown[]) => unknown).apply(this, args);
    };
  }
}

/** Turn the observations into the one line the report prints, verdict included. */
export function summariseDragEndings(
  observations: readonly string[],
  installed: InstalledHooks = { token: true, manager: true }
): string {
  if (!installed.token) {
    return 'NOT WATCHING. The observers never installed, so this line says nothing about the drag.';
  }
  if (observations.length === 0) {
    return installed.manager
      ? 'NOTHING observed, and the observers ARE installed, so Foundry genuinely did none of these.'
      : 'nothing observed, but the MANAGER hook never installed, so a cancel at GRABBED would be invisible.';
  }
  const joined = observations.join(' then ');
  if (observations.some((note) => note.includes('DURING THE DRAG'))) {
    return `${joined} <em>(a REDRAW cancelled the interaction, which is why nothing was written)</em>`;
  }
  if (observations.some((note) => note.includes('_onDragLeftDrop'))) {
    return `${joined} <em>(dropped, so Foundry tried to commit and the write itself refused)</em>`;
  }
  if (observations.some((note) => note.includes('Cancel') || note.includes('cancel'))) {
    return `${joined} <em>(CANCELLED, which writes nothing)</em>`;
  }
  return joined;
}
