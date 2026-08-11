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
 * Install the observers, once.
 *
 * Returns whether anything was installed, so a caller can keep trying until the canvas exists rather
 * than assuming it did.
 */
export function installFoundryDragHooks(options: FoundryDragHookOptions): boolean {
  const tokenPrototype = options.getTokenPrototype();
  if (tokenPrototype === undefined) {
    return false;
  }

  hookManager(options);
  hookRedraws(tokenPrototype, options);
  hookEndings(tokenPrototype, options);
  return true;
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
function hookManager(options: FoundryDragHookOptions): void {
  const managerPrototype = options.getManagerPrototype();
  if (managerPrototype === undefined) {
    return;
  }

  for (const name of ['cancel', 'reset']) {
    const original = managerPrototype[name];
    if (typeof original !== 'function') {
      continue;
    }
    managerPrototype[name] = function wrapped(this: { state?: unknown }, ...args: unknown[]) {
      const state = STATE_NAMES[this.state as number] ?? String(this.state);
      options.onObservation(`manager.${name} at ${state} [${describeCause(args[0])}]`);
      return (original as (...inner: unknown[]) => unknown).apply(this, args);
    };
  }
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
export function summariseDragEndings(observations: readonly string[]): string {
  if (observations.length === 0) {
    return 'NOTHING observed. Foundry never started, cancelled or ended a drag on this token.';
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
