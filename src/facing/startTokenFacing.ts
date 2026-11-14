import { MODULE_ID } from '../constants.js';
import { logger } from '../core/Logger.js';
import { registerGmMenu } from '../bands/settingsMenu.js';
import type { MenuGlobals, MenuSettings } from '../bands/settingsMenu.js';
import { facingChange, missingScale, newActorFacing, uprightRotation } from './tokenFacing.js';
import type { PlacedFacing, PrototypeFacing } from './tokenFacing.js';

/**
 * Default token facing: a world setting, its creation hooks, the GM's "apply to every actor" button, and
 * keeping the Mirror ticks in PF2e's Prototype Token form. Added 2026-11-14; the rules are in
 * tokenFacing.ts.
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
  readonly prototypeToken?: PrototypeFacing;
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
  };
  readonly foundry?: MenuGlobals['foundry'] & {
    readonly applications?: {
      readonly api?: { readonly DialogV2?: { confirm?(options: object): Promise<unknown> } };
    };
  };
  readonly ui?: { readonly notifications?: { info?(message: string): unknown } };
}

/**
 * Gives every actor in the world the default facing. Resolves to how many changed, or null when this
 * browser is not a GM's. Never run by itself: the GM's settings button and the API call are its callers.
 */
export async function applyTokenFacing(globals: FacingGlobals): Promise<number | null> {
  /* ⛔ GM only, failing closed: it changes every actor in the world. The menu is restricted too. */
  const game = globals.game;
  if (game?.user?.isGM !== true || game.actors === undefined) {
    return null;
  }
  const updates = game.actors.contents.flatMap((actor) => {
    const change = actor.id === null ? null : facingChange(actor.prototypeToken);
    return change === null ? [] : [{ _id: actor.id, prototypeToken: change }];
  });
  if (updates.length > 0) {
    await game.actors.documentClass.updateDocuments(updates);
  }
  globals.ui?.notifications?.info?.(
    `Tongs set the default token facing on ${String(updates.length)} ${updates.length === 1 ? 'actor' : 'actors'}.`
  );
  return updates.length;
}

/** The settings button: asks first, because it changes every actor in the world. */
async function confirmAndApply(globals: FacingGlobals): Promise<number | null> {
  const confirmed = await globals.foundry?.applications?.api?.DialogV2?.confirm?.({
    window: { title: 'Default token facing for every actor' },
    content:
      "<p>Mirror every actor's prototype token both ways and unlock its rotation? Tokens already on a " +
      'scene are not changed. New tokens are placed at rotation 180, so they show upright.</p>',
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
    name: 'Default token facing: mirror both ways, unlocked rotation',
    hint:
      'New actors get a prototype token mirrored horizontally and vertically, free to rotate, and new tokens ' +
      'with such art are placed at rotation 180 so they show upright. For existing actors, use "Apply to every actor".',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });
  const on = (): boolean => settings.get(MODULE_ID, FACING_SETTING) !== false;
  hooks.on(
    'preCreateActor',
    (
      actor: Creating<{ prototypeToken?: PrototypeFacing }>,
      data: { prototypeToken?: PrototypeFacing }
    ) => {
      const change = on()
        ? newActorFacing(data.prototypeToken, actor._source?.prototypeToken)
        : null;
      if (change !== null) {
        actor.updateSource?.({ prototypeToken: change });
      }
    }
  );
  hooks.on('preCreateToken', (token: Creating<PlacedFacing>) => {
    const rotation = on() ? uprightRotation(token._source ?? {}) : null;
    if (rotation !== null) {
      token.updateSource?.({ rotation });
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
      hint: "Mirror every existing actor's prototype token both ways and unlock its rotation. Asks first.",
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
