/**
 * Foundry's interaction state, sampled AS IT HAPPENS. Extracted from TongsBrowser 2026-08-12.
 *
 * ⚠️ Sampled during the gesture rather than read when the report is written, and that distinction is
 * the whole reason this exists. Foundry resets the manager to NONE the moment an interaction ends, so
 * a reading taken afterwards says NONE whether the drag never started or ran perfectly and
 * committed. Only a peak kept across the gesture can tell those apart.
 */

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface InteractionSample {
  /** Foundry's MouseInteractionManager state: NONE, HOVER, CLICKED, GRABBED, DRAG, DROP. */
  readonly interactionState: number | undefined;
  /** How many drag preview clones exist. A drag that reached DRAG has one; a stalled one has none. */
  readonly previewCount: number;
  /** Where Foundry believes the drag began, which its 10px gate is measured from. */
  readonly foundryOrigin: ScreenPoint | undefined;
  /**
   * PIXI's own pointer.
   *
   * Read rather than ours, because `event.global` is what Foundry actually measures its gate
   * against, and the two disagreeing was a live candidate for a long time.
   */
  readonly pixiPointer: ScreenPoint | undefined;
}

interface ControlledToken {
  readonly mouseInteractionManager?: {
    readonly state?: number;
    readonly interactionData?: { readonly screenOrigin?: ScreenPoint };
  };
}

export interface InteractionGlobals {
  readonly canvas?: {
    readonly tokens?: {
      readonly controlled?: readonly ControlledToken[];
      readonly preview?: { readonly children?: readonly unknown[] };
    };
    readonly app?: {
      readonly renderer?: {
        readonly events?: { readonly pointer?: { readonly global?: ScreenPoint } };
      };
    };
  };
}

/**
 * ⚠️ The controlled token is resolved ONCE and every field read off that one reference.
 *
 * It used to be reached twice, once for the state and once for the manager, which is two reads of a
 * live array a few lines apart. Between them a selection can change or a token can be released, and
 * the sample would then pair one token's interaction state with another token's drag origin: a
 * reading that describes no moment that ever existed, and which looks entirely ordinary in the
 * report. Same rule as `readFoundryFacts` and the PIXI counters.
 */
export function readInteractionSample(globals: InteractionGlobals): InteractionSample {
  const tokens = globals.canvas?.tokens;
  const token = tokens?.controlled?.[0];
  const manager = token?.mouseInteractionManager;

  return {
    interactionState: manager?.state,
    previewCount: tokens?.preview?.children?.length ?? 0,
    foundryOrigin: manager?.interactionData?.screenOrigin,
    pixiPointer: globals.canvas?.app?.renderer?.events?.pointer?.global,
  };
}
