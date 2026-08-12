import type { ScenePoint, TokenBox } from './TokenHitTest.js';

/**
 * Everything the diagnostics report reads out of Foundry, gathered in one place. Extracted from
 * TongsBrowser 2026-08-12.
 *
 * ⚠️ Every field is read ONCE, here, rather than at each point of use. The report is a snapshot of a
 * moment, and a field read later than its neighbours describes a different moment: Foundry resets the
 * interaction manager as soon as a gesture ends, so two reads a few lines apart can straddle the very
 * transition being investigated.
 */

/** The selected token, described as far as the report reads it. */
export interface SelectedToken extends TokenBox {
  readonly name?: string;
  readonly id?: string;
  /** Foundry's own permission check. Present only on a drawn placeable. */
  readonly _canDrag?: (user: unknown) => boolean;
}

export interface FoundryGlobals {
  readonly game?: Record<string, unknown>;
  readonly canvas?: Record<string, unknown>;
}

export interface FoundryFacts {
  readonly userId: string | undefined;
  readonly isGm: boolean;
  readonly paused: boolean;
  readonly activeTool: string;
  readonly manifestVersion: string;
  readonly canvasReady: string;
  readonly selected: SelectedToken | undefined;
  readonly mouse: ScenePoint | undefined;
  readonly canDrag: string;
}

/**
 * Read Foundry's state, or null when there is no game to read.
 *
 * Null rather than a blank report, because a report full of "unknown" looks like a measurement that
 * came back empty. It is not: it means the button was pressed before the world finished loading, and
 * that is a different thing for the reader to do about it.
 */
export function readFoundryFacts(globals: FoundryGlobals, moduleId: string): FoundryFacts | null {
  const game = globals.game;
  if (game === undefined) {
    return null;
  }

  const user = game['user'] as { id?: string; isGM?: boolean } | undefined;
  const tokens = globals.canvas?.['tokens'] as { controlled?: SelectedToken[] } | undefined;
  const selected = tokens?.controlled?.[0];

  const modules = game['modules'] as
    { get?: (id: string) => { version?: string } | undefined } | undefined;

  return {
    userId: user?.id,
    isGm: user?.isGM === true,
    paused: game['paused'] === true,
    activeTool: String(game['activeTool']),
    /*
     * ⚠️ The build stamp is not enough on its own. It says what was COMPILED; this says what Foundry
     * actually loaded, and the two disagreeing is precisely the "am I even running the version you
     * think I am" question that cost a full round trip when a device reported against a stale copy.
     */
    manifestVersion: modules?.get?.(moduleId)?.version ?? 'unknown',
    canvasReady: String(globals.canvas?.['ready']),
    selected,
    mouse: globals.canvas?.['mousePosition'] as ScenePoint | undefined,
    /*
     * Foundry's own permission answer, not ours. If this says false the drag was never going to work
     * and nothing else in the report matters, so guessing it would be worse than admitting 'n/a'.
     */
    canDrag: selected?._canDrag === undefined ? 'n/a' : String(selected._canDrag(user)),
  };
}
