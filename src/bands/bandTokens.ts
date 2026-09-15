import { allCombatants, combatsWithToken } from '../automation/tokenCombats.js';
import type { CombatRef } from '../automation/tokenCombats.js';
import { parseTokenUuid } from '../deck/buildApplyPorts.js';
import { readBandSubject } from './bandSubject.js';
import type { CampaignCombatant } from './combatCampaign.js';
import type { BandSubject, NameRules, TokenView } from './bandSubject.js';

/**
 * Reading Foundry's tokens into what a band needs. Added 2026-09-14.
 *
 * ⛔ MEASURED on pf2e 8.5.0, 2026-09-14, before this was written:
 *
 * - `updateActor` fires for BOTH kinds of token. An unlinked token's change arrives as its synthetic
 *   actor, `isToken: true`, with `actor.token` the token document; a linked actor's arrives with
 *   `isToken: false`, and every token of it on the scene shows the change.
 * - `hasCondition('invisible')` answers on PF2e actors; `document.hidden` is the GM's hide toggle.
 * - The name rule and "The creature" are PF2e's own; see `bandSubject.ts`.
 *
 * ⚠️ Every Foundry method is called on its own object (`actor.getActiveTokens`, `actor.hasCondition`,
 * `combatants.contents`), the rule the automation's adapters already follow.
 */
export interface TokenDocLike {
  readonly id?: string;
  readonly uuid?: string;
  readonly name?: string;
  readonly hidden?: boolean;
  readonly playersCanSeeName?: boolean;
  /** The token's art: a Forge asset URL, or a path relative to the game. */
  readonly texture?: { readonly src?: string | null } | null;
  readonly actor?: ActorLike | null;
}

export interface ActorLike {
  readonly isToken?: boolean;
  readonly token?: TokenDocLike | null;
  readonly hasPlayerOwner?: boolean;
  readonly alliance?: string | null;
  readonly system?: {
    readonly attributes?: { readonly hp?: { readonly value?: number; readonly max?: number } };
    readonly traits?: { readonly value?: readonly string[] };
  };
  getActiveTokens?(linked: boolean, document: boolean): readonly TokenDocLike[];
  hasCondition?(slug: string): boolean;
}

export interface BandCombatant extends CampaignCombatant {
  readonly tokenId?: string;
  readonly sceneId?: string;
  readonly token?: (TokenDocLike & NonNullable<CampaignCombatant['token']>) | null;
}

/** ⛔ EVERY encounter, not the one the tracker shows: see `automation/tokenCombats.ts`. */
export interface BandGlobals {
  readonly game?: {
    readonly combats?: { readonly contents?: readonly CombatRef<BandCombatant>[] } | null;
    readonly pf2e?: {
      readonly settings?: { readonly tokens?: { readonly nameVisibility?: boolean } };
    };
    readonly i18n?: { localize?(key: string): string };
  };
  /** Where the game is served from, so a token path relative to it can be sent as a full URL. */
  readonly location?: { readonly href?: string };
}

/**
 * A token's art as a full URL, or null. Added 2026-09-15 for the band album. ⚠️ Only http and https leave the
 * browser: a data: or blob: URL means nothing to the server, and a path relative to the game is resolved
 * against where the game is served, which on The Forge is a public host.
 */
export function imageUrl(src: string | null | undefined, globals: BandGlobals): string | null {
  if (typeof src !== 'string' || src === '') {
    return null;
  }
  try {
    const url = new URL(src, globals.location?.href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** PF2e's conditions that keep a creature from the players' view, whatever its token shows. */
export const UNSEEN = ['invisible', 'undetected', 'unnoticed'];
const MYSTIFIED_KEY = 'PF2E.Token.Mystified.TheCreature';

export function nameRules(globals: BandGlobals): NameRules {
  const localized = globals.game?.i18n?.localize?.(MYSTIFIED_KEY);
  return {
    nameVisibility: globals.game?.pf2e?.settings?.tokens?.nameVisibility === true,
    mystifiedName:
      localized === undefined || localized === MYSTIFIED_KEY ? 'The creature' : localized,
  };
}

export function viewOf(token: TokenDocLike, globals: BandGlobals): TokenView | null {
  const actor = token.actor;
  const hp = actor?.system?.attributes?.hp;
  if (
    actor === null ||
    actor === undefined ||
    typeof token.uuid !== 'string' ||
    typeof hp?.value !== 'number' ||
    typeof hp.max !== 'number'
  ) {
    return null;
  }
  return {
    tokenUuid: token.uuid,
    name: token.name ?? '',
    hidden: token.hidden === true,
    playersCanSeeName: token.playersCanSeeName === true,
    hp: hp.value,
    maxHp: hp.max,
    traits: actor.system?.traits?.value ?? [],
    ally: actor.hasPlayerOwner === true || actor.alliance === 'party',
    inCombat: combatOfToken(globals, token.uuid) !== undefined,
    unseen: UNSEEN.some((slug) => actor.hasCondition?.(slug) === true),
    image: imageUrl(token.texture?.src, globals),
  };
}

const subjectOf = (token: TokenDocLike, globals: BandGlobals): BandSubject | null => {
  const view = viewOf(token, globals);
  return view === null ? null : readBandSubject(view, nameRules(globals));
};

/** The encounter a token is fighting in, a started one first; undefined when it is in none. */
export function combatOfToken(
  globals: BandGlobals,
  tokenUuid: string
): CombatRef<BandCombatant> | undefined {
  const ids = parseTokenUuid(tokenUuid);
  return ids === null ? undefined : combatsWithToken(globals, ids.sceneId, ids.tokenId)[0];
}

/**
 * The tokens an `updateActor` concerns: the synthetic actor's one token, or every token of a linked
 * actor, on the viewed scene or fighting in any encounter on another.
 */
export function subjectsForActor(actor: unknown, globals: BandGlobals): (BandSubject | null)[] {
  const doc = actor as ActorLike | null | undefined;
  if (doc?.isToken === true) {
    return [doc.token]
      .filter((t): t is TokenDocLike => t !== null && t !== undefined)
      .map((token) => subjectOf(token, globals));
  }
  if (doc === null || doc === undefined) {
    return [];
  }
  const fighting = allCombatants(globals).flatMap(({ combatant }) =>
    combatant.token?.actor === doc ? [combatant.token] : []
  );
  /* One token document is one object, whether the scene or an encounter handed it over. */
  const tokens = new Set([...(doc.getActiveTokens?.(true, true) ?? []), ...fighting]);
  return [...tokens].map((token) => subjectOf(token, globals));
}

/** Every token in every encounter, to remember its band before anything changes. */
export function combatSubjects(globals: BandGlobals): (BandSubject | null)[] {
  return allCombatants(globals).map(({ combatant }) =>
    combatant.token ? subjectOf(combatant.token, globals) : null
  );
}
