import { MODULE_ID } from '../constants.js';

/**
 * PF2e's "Take a Breather" under the GMG's No-Limit Stamina option: no Resolve Point. Added 2026-11-02.
 *
 * ⭐ LEWIS, 2026-11-02: "Could we add a take an unlimited stamina version of the take a breather macro to
 * TONGS that does this but doesn't use a resolve point for out of combat healing?"
 *
 * Ported from `takeABreather` in PF2e 8.6.1 (`src/scripts/macros/take-a-breather.ts`, the system macro's
 * whole body is `game.pf2e.actions.takeABreather();`). Kept the same: the selected tokens, else the
 * user's assigned character (PF2e's `UserPF2e.getActiveTokens`), characters only, the same confirm
 * dialog, Stamina Points refilled to their max, and one chat card per character spoken as its token.
 *
 * ⚠️ What differs, on purpose:
 * - No Resolve Point is needed or spent, and the card says so, so nobody reads it as the rules' version.
 * - A world without the Stamina variant is TOLD so. PF2e returns silently there, and a macro that does
 *   nothing with no word looks broken.
 * - A character in a started encounter is skipped: this is the out-of-combat version, and unlimited
 *   Stamina mid-fight is not what Lewis asked for.
 * - The assigned character counts with no token on the scene; PF2e's needs one placed.
 * - The update is awaited before the card is posted, so the card never claims a refill that failed.
 */
export const BREATHER_TITLE = 'Take a Breather (No-Limit Stamina)';

/** The chat card's flag, under the module's scope, carrying the facts for the combat topic. */
export const BREATHER_FLAG = 'breather';

interface Pool {
  readonly value: number;
  readonly max: number;
}

export interface BreatherActor {
  readonly id?: string | null;
  readonly uuid?: string;
  readonly img?: string;
  readonly name?: string | null;
  readonly inCombat?: boolean;
  readonly system?: { readonly attributes?: { readonly hp?: { readonly sp?: Pool | null } } };
  isOfType?(...types: string[]): boolean;
  getActiveTokens?(
    linked?: boolean,
    document?: boolean
  ): readonly { readonly name?: string; readonly texture?: { readonly src?: string } }[];
  update?(data: object): Promise<unknown>;
}

interface ChatClass {
  getSpeaker?(options: object): object;
  create?(data: object): Promise<unknown>;
}

export interface BreatherGlobals {
  readonly game?: {
    readonly pf2e?: { readonly settings?: { readonly variants?: { readonly stamina?: unknown } } };
    readonly user?: {
      readonly character?: BreatherActor | null;
      getActiveTokens?(): readonly { readonly actor?: BreatherActor | null }[];
    };
    readonly combat?: { readonly started?: boolean } | null;
  };
  readonly ui?: {
    readonly notifications?: {
      warn?(message: string): unknown;
      error?(message: string): unknown;
    };
  };
  readonly foundry?: {
    readonly applications?: {
      readonly api?: { readonly DialogV2?: { confirm?(options: object): Promise<unknown> } };
    };
  };
  readonly ChatMessage?: ChatClass & { readonly implementation?: ChatClass };
}

export type BreatherOutcome =
  | { readonly kind: 'no-stamina' }
  | { readonly kind: 'no-character' }
  | { readonly kind: 'cancelled' }
  | {
      readonly kind: 'done';
      readonly refreshed: readonly string[];
      readonly skipped: readonly string[];
    };

export const NO_STAMINA_TEXT =
  `${BREATHER_TITLE} does nothing in this world: it does not use the Stamina variant rule, ` +
  'so there are no Stamina Points to regain.';
/** PF2e's own `PF2E.ErrorMessage.NoPCTokenSelected`, in English. */
export const NO_CHARACTER_TEXT = 'Select at least one token associated with a PC.';

/** The card, PF2e's wording with "spends a resolve point" taken out and the difference said plainly. */
export function breatherCard(name: string, sp: Pool): string {
  return (
    `${name} has ${String(sp.value)}/${String(sp.max)} SP and takes a 10 minute breather out of combat. ` +
    `Stamina refreshed to ${String(sp.max)}/${String(sp.max)}. ` +
    `<em>No-Limit Stamina: no Resolve Point spent (Tongs, out of combat).</em>`
  );
}

export async function takeABreatherNoLimit(globals: BreatherGlobals): Promise<BreatherOutcome> {
  const game = globals.game;
  if (game?.pf2e?.settings?.variants?.stamina !== true) {
    globals.ui?.notifications?.warn?.(NO_STAMINA_TEXT);
    return { kind: 'no-stamina' };
  }
  /* ⚠️ The assigned character even with no token on the scene: resting needs no map, PF2e's does. */
  const tokens = game.user?.getActiveTokens?.() ?? [];
  const actors = characters(tokens.length > 0 ? tokens : [{ actor: game.user?.character }]);
  if (actors.length === 0) {
    globals.ui?.notifications?.error?.(NO_CHARACTER_TEXT);
    return { kind: 'no-character' };
  }
  const confirmed = await globals.foundry?.applications?.api?.DialogV2?.confirm?.({
    window: { title: BREATHER_TITLE },
    content:
      '<div>Rest for 10 minutes out of combat and regain stamina? No-Limit Stamina: no Resolve Point is spent.</div>',
    yes: { default: true },
  });
  if (confirmed !== true) {
    return { kind: 'cancelled' };
  }
  const chat = globals.ChatMessage?.implementation ?? globals.ChatMessage;
  const refreshed: string[] = [];
  const skipped: string[] = [];
  for (const actor of actors) {
    const sp = actor.system?.attributes?.hp?.sp;
    const token = actor.getActiveTokens?.(true, true)[0];
    const name = token?.name ?? actor.name ?? 'A character';
    if (sp === undefined || sp === null) {
      continue;
    }
    const speaker = chat?.getSpeaker?.({ token, actor }) ?? { alias: name };
    if (actor.inCombat === true && game.combat?.started === true) {
      skipped.push(name);
      await chat?.create?.({
        speaker,
        content: `${name} is in an encounter, so cannot take the out-of-combat breather until it ends.`,
      });
      continue;
    }
    await actor.update?.({ 'system.attributes.hp.sp.value': sp.max });
    refreshed.push(name);
    /* The flag is what the GM's browser posts to the combat topic from (`breatherPost.ts`). */
    const breather = {
      actorUuid: actor.uuid,
      name,
      spBefore: sp.value,
      maxSp: sp.max,
      img: token?.texture?.src ?? actor.img,
    };
    await chat?.create?.({
      speaker,
      content: breatherCard(name, sp),
      flags: { [MODULE_ID]: { [BREATHER_FLAG]: breather } },
    });
  }
  return { kind: 'done', refreshed, skipped };
}

/** PF2e's own filter: each actor once, none missing, characters only. */
function characters(
  tokens: readonly { readonly actor?: BreatherActor | null | undefined }[]
): BreatherActor[] {
  const seen = new Set<BreatherActor>();
  for (const token of tokens) {
    if (token.actor?.isOfType?.('character') === true) {
      seen.add(token.actor);
    }
  }
  return [...seen];
}
