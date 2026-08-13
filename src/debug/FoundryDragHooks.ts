import { STATE_NAMES, describeCallSite, describeCause } from './DragCallSite.js';
import { describeRedrawEffect } from './RedrawEffect.js';

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

/** The shape of a wrappable prototype: a bag of methods, which is all this needs. */
type Prototype = Record<string, unknown>;

/**
 * The marker a wrapper carries so it is never wrapped again. Added 2026-08-13.
 *
 * ⚠️ `Symbol.for`, not a fresh symbol, and not a string property. Registry symbols are shared across
 * module instances, so a second copy of this bundle recognises the first one's wrappers - which is
 * not hypothetical here, since a stale module install sitting beside a live one is a state this
 * project has already been in.
 *
 * COVERS: the same prototype method wrapped twice, from any number of module instances.
 * MISSES: a wrapper installed by some OTHER module, which we cannot and should not recognise.
 * PROVEN: tests/dom/foundryDragHooks.test.ts installs the hooks twice and asserts ONE observation.
 */
const OBSERVED = Symbol.for('tongs-browser.drag-observer');

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
 *
 * ⚠️ SAFE TO CALL REPEATEDLY, and it has to be, because the caller retries until the manager appears.
 * Until 2026-08-13 it was not: each call re-wrapped the token prototype over the previous wrapper, so
 * after N calls ONE real `_onDragLeftStart` announced itself N times. `DragRecorder` calls this on
 * every dispatched event, so a device reached ~150 layers deep and reported ~150 drag starts and
 * ~150 redraws for a single drag that had exactly one of each. Every Foundry token redraw in that
 * session then ran through 150 stack frames of diagnostics that promised not to change anything.
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
 * Replace a prototype method with a wrapper, at most once per method.
 *
 * ⚠️ `prototype[name] = wrap(prototype[name])` is a read-modify-write, so running it twice COMPOSES
 * rather than replaces. Nothing at the call site looks wrong; the damage is entirely in the
 * arithmetic of repetition. Idempotence has to be carried by the wrapper itself, because the callers
 * that retry are correct to retry.
 */
function wrapOnce(
  prototype: Prototype,
  name: string,
  build: (
    original: (...args: unknown[]) => unknown
  ) => (this: unknown, ...args: unknown[]) => unknown
): void {
  const original = prototype[name];
  if (typeof original !== 'function') {
    return;
  }
  if ((original as unknown as Record<symbol, unknown>)[OBSERVED] === true) {
    return;
  }
  const wrapper = build(original as (...args: unknown[]) => unknown);
  (wrapper as unknown as Record<symbol, unknown>)[OBSERVED] = true;
  prototype[name] = wrapper;
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
    wrapOnce(managerPrototype, name, (original) => {
      return function wrapped(this: unknown, ...args: unknown[]) {
        // Read through a local rather than annotating `this`: a narrower `this` on the wrapper makes
        // it unassignable to the generic wrapper shape, since `this` types are contravariant.
        const { state: current } = (this ?? {}) as { state?: unknown };
        const state = STATE_NAMES[current as number] ?? String(current);
        const via = name === 'cancel' ? ` via ${describeCallSite()}` : '';
        options.onObservation(`manager.${name} at ${state}${via} [${describeCause(args[0])}]`);
        return original.apply(this, args);
      };
    });
  }
  return true;
}

/**
 * Redraws, which destroy the interaction underneath them. See debug/RedrawEffect.ts for the rule.
 *
 * The effect is READ rather than asserted, and read BEFORE delegating, because the original redraw
 * is what performs the cancel and resets the state.
 */
function hookRedraws(prototype: Prototype, options: FoundryDragHookOptions): void {
  for (const name of ['draw', 'destroy']) {
    wrapOnce(prototype, name, (original) => {
      return function wrapped(this: unknown, ...args: unknown[]) {
        if (options.isRecording()) {
          options.onObservation(`token.${name} ${describeRedrawEffect(this)}`);
        }
        return original.apply(this, args);
      };
    });
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
    wrapOnce(prototype, name, (original) => {
      return function wrapped(this: unknown, ...args: unknown[]) {
        options.onObservation(`${name} [${describeCause(args[0])}]`);
        return original.apply(this, args);
      };
    });
  }
}
