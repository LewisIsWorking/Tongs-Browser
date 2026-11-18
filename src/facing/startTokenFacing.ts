import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import { registerGmMenu } from '../bands/settingsMenu.js';
import type { MenuGlobals, MenuSettings } from '../bands/settingsMenu.js';
import { facingChange, missingScale, newActorFacing, uprightRotation } from './tokenFacing.js';
import type { FacingChange, PlacedFacing, PrototypeFacing } from './tokenFacing.js';
import { visionChange } from './tokenVision.js';
import type { SightFacing, VisionChange } from './tokenVision.js';

/**
 * Default token facing: a world setting, its creation hooks, the GM's "apply to every actor" button, and
 * keeping the Mirror ticks in PF2e's Prototype Token form. Added 2026-11-14; the rules are in
 * tokenFacing.ts. Since 2026-11-18 the same setting also turns every token's vision on at 160 degrees
 * (tokenVision.ts), and the button gives that vision to tokens already on a scene too.
 *
 * ⚠️ ON by default. PF2e marks every new actor's prototype `lockRotation` true (its schema's initial
 *    value), so without this every new token is locked and unmirrored.
 * ⚠️ `preCreate*` hooks run ONLY in the browser that creates the document, so exactly one browser
 *    changes it, before it is saved: no second write, and nothing for a GM to be online for.
 * ⚠️ Existing actors are never changed by themselves: only the GM's button or the API call does it.
 */
export const FACING_SETTING = 'defaultTokenFacing';

export interface FacingSettings extends MenuSettings {
  register(namespace: string, key: string, data: FoundrySettingRegistration): void;
  get(namespace: string, key: string): unknown;
}

/** A document in a `preCreate*` hook: its source so far, and how to change it before it is saved. */
interface Creating<Source> {
  readonly _source?: Source;
  updateSource?(changes: object): unknown;
}

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

interface FormDataLike {
  readonly object?: Record<string, unknown>;
}

interface PrototypeConfig {
  readonly form?: EventTarget | null;
  readonly token?: { readonly _source?: PlacedFacing };
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
function together(
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
 * Gives every actor in the world the default facing and vision, and every placed token the vision. Resolves to how many changed, or null when this
 * browser is not a GM's. Never run by itself: the GM's settings button and the API call are its callers.
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
async function confirmAndApply(globals: FacingGlobals): Promise<number | null> {
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

/** Wired forms, so a form re-rendered many times still gets one listener. */
const wiredForms = new WeakSet<EventTarget>();

/** Keeps the Mirror ticks when PF2e's auto-scale has locked the Scale slider (the bug: tokenFacing.ts). */
export function keepMirrorTicks(app: PrototypeConfig): void {
  const form = app.form;
  if (form === undefined || form === null || wiredForms.has(form)) {
    return;
  }
  wiredForms.add(form);
  form.addEventListener('formdata', (event) => {
    const submitted = (event as Event & { formData?: FormDataLike }).formData?.object;
    const scale =
      submitted === undefined ? null : missingScale(submitted, app.token?._source?.texture?.scaleX);
    if (submitted !== undefined && scale !== null) {
      submitted['scale'] = scale;
    }
  });
}

export function startTokenFacing(
  hooks: FoundryHooks,
  settings: FacingSettings,
  globals: FacingGlobals
): void {
  settings.register(MODULE_ID, FACING_SETTING, {
    name: 'Default token facing: mirror both ways, unlocked rotation, vision on at 160 degrees',
    hint:
      'New actors get a prototype token mirrored horizontally and vertically, free to rotate, with vision on ' +
      'at 160 degrees (a full 360 becomes 160; any other angle stays). New tokens with such art are placed at ' +
      'rotation 180 so they show upright. For existing actors and tokens, use "Apply to every actor".',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });
  const on = (): boolean => settings.get(MODULE_ID, FACING_SETTING) !== false;
  hooks.on(
    'preCreateActor',
    (
      actor: Creating<{ prototypeToken?: PrototypeFacing & SightFacing }>,
      data: { prototypeToken?: PrototypeFacing }
    ) => {
      const source = actor._source?.prototypeToken;
      const change = on()
        ? together(newActorFacing(data.prototypeToken, source), visionChange(source))
        : null;
      if (change !== null) {
        actor.updateSource?.({ prototypeToken: change });
      }
    }
  );
  hooks.on('preCreateToken', (token: Creating<PlacedFacing & SightFacing>) => {
    if (!on()) {
      return;
    }
    const source = token._source ?? {};
    const rotation = uprightRotation(source);
    const change = { ...(rotation === null ? {} : { rotation }), ...visionChange(source) };
    if (Object.keys(change).length > 0) {
      token.updateSource?.(change);
    }
  });
  hooks.on('renderPrototypeTokenConfig', keepMirrorTicks);
  registerGmMenu(
    settings,
    globals,
    {
      key: 'tokenFacingMenu',
      name: 'Default token facing for every actor',
      label: 'Apply to every actor',
      hint:
        "Mirror every existing actor's prototype token both ways, unlock its rotation and turn its vision " +
        'on at 160 degrees; tokens already on a scene get the vision. Asks first.',
      icon: 'fas fa-arrows-rotate',
    },
    async () =>
      confirmAndApply(globals).catch((error: unknown) => {
        logger.warn(
          `Default token facing was not applied: ${error instanceof Error ? error.message : String(error)}`
        );
        return null;
      })
  );
}
