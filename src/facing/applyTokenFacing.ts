import { facingChange } from './tokenFacing.js';
import type { FacingChange, PrototypeFacing } from './tokenFacing.js';
import { visionChange } from './tokenVision.js';
import type { SightFacing, VisionChange } from './tokenVision.js';
import type { MenuGlobals } from '../bands/settingsMenu.js';

/**
 * Default token facing for what already exists: the GM's "Apply to every actor" button and the API call a
 * GM's macro makes. Moved out of startTokenFacing.ts on 2026-11-18, when vision joined the facing and the
 * button started giving tokens already on a scene the vision too.
 *
 * ⛔ GM only, failing closed: it changes every actor in the world and every placed token's vision.
 * ⚠️ A placed token gets the VISION only. Its mirror and rotation are its look, set when it was placed.
 */
interface WorldActor {
  readonly id: string | null;
  readonly prototypeToken?: PrototypeFacing & SightFacing;
}

/** A token already on a scene: only its vision is changed, never its look. */
interface PlacedToken extends SightFacing {
  readonly id: string | null;
}

interface WorldScene {
  readonly tokens?: { readonly contents: readonly PlacedToken[] };
  updateEmbeddedDocuments?(type: 'Token', updates: object[]): Promise<unknown>;
}

export interface FacingGlobals extends MenuGlobals {
  readonly game?: {
    readonly user?: { readonly isGM?: boolean };
    readonly actors?: {
      readonly contents: readonly WorldActor[];
      readonly documentClass: { updateDocuments(updates: object[]): Promise<unknown> };
    };
    readonly scenes?: { readonly contents: readonly WorldScene[] };
  };
  readonly foundry?: MenuGlobals['foundry'] & {
    readonly applications?: {
      readonly api?: { readonly DialogV2?: { confirm?(options: object): Promise<unknown> } };
    };
  };
  readonly ui?: { readonly notifications?: { info?(message: string): unknown } };
}

/** Facing and vision in one change, so a document is written once. Null when neither changes anything. */
export function together(
  facing: FacingChange | null,
  vision: VisionChange | null
): (Partial<FacingChange> & Partial<VisionChange>) | null {
  return facing === null && vision === null ? null : { ...facing, ...vision };
}

/** Gives every token already on a scene the default vision. Resolves to how many changed. */
async function applyPlacedVision(scenes: readonly WorldScene[]): Promise<number> {
  let changed = 0;
  for (const scene of scenes) {
    const updates = (scene.tokens?.contents ?? []).flatMap((token) => {
      const change = token.id === null ? null : visionChange(token);
      return change === null ? [] : [{ _id: token.id, ...change }];
    });
    if (updates.length > 0 && scene.updateEmbeddedDocuments !== undefined) {
      await scene.updateEmbeddedDocuments('Token', updates);
      changed += updates.length;
    }
  }
  return changed;
}

const plural = (n: number, one: string): string => `${String(n)} ${n === 1 ? one : `${one}s`}`;

/**
 * Gives every actor in the world the default facing and vision, and every placed token the vision.
 * Resolves to how many actors changed, or null when this browser is not a GM's. Never run by itself: the
 * GM's settings button and the API call are its callers.
 */
export async function applyTokenFacing(globals: FacingGlobals): Promise<number | null> {
  /* ⛔ GM only, failing closed: it changes every actor in the world. The menu is restricted too. */
  const game = globals.game;
  if (game?.user?.isGM !== true || game.actors === undefined) {
    return null;
  }
  const updates = game.actors.contents.flatMap((actor) => {
    const change =
      actor.id === null
        ? null
        : together(facingChange(actor.prototypeToken), visionChange(actor.prototypeToken));
    return change === null ? [] : [{ _id: actor.id, prototypeToken: change }];
  });
  if (updates.length > 0) {
    await game.actors.documentClass.updateDocuments(updates);
  }
  const placed = await applyPlacedVision(game.scenes?.contents ?? []);
  globals.ui?.notifications?.info?.(
    `Tongs set the default token facing and vision on ${plural(updates.length, 'actor')}, and the ` +
      `vision on ${plural(placed, 'token')} already on a scene.`
  );
  return updates.length;
}

/** The settings button: asks first, because it changes every actor in the world. */
export async function confirmAndApply(globals: FacingGlobals): Promise<number | null> {
  const confirmed = await globals.foundry?.applications?.api?.DialogV2?.confirm?.({
    window: { title: 'Default token facing for every actor' },
    content:
      "<p>Mirror every actor's prototype token both ways, unlock its rotation and turn its vision on at " +
      '160 degrees? Tokens already on a scene get the vision only; their look is not changed. New tokens ' +
      'are placed at rotation 180, so they show upright.</p>',
  });
  return confirmed === true ? applyTokenFacing(globals) : null;
}

/** What the module's `api` gains: `applyTokenFacingToAllActors()`, for a GM's macro. */
export function facingApi(globals: object): {
  applyTokenFacingToAllActors(): Promise<number | null>;
} {
  return { applyTokenFacingToAllActors: async () => applyTokenFacing(globals) };
}
