import { readBandSubject } from './bandSubject.js';
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

export interface BandGlobals {
  readonly game?: {
    readonly combat?: {
      readonly combatants?: {
        readonly contents?: readonly {
          readonly tokenId?: string;
          readonly token?: TokenDocLike | null;
        }[];
      };
    } | null;
    readonly pf2e?: {
      readonly settings?: { readonly tokens?: { readonly nameVisibility?: boolean } };
    };
    readonly i18n?: { localize?(key: string): string };
  };
}

const UNSEEN = ['invisible', 'undetected', 'unnoticed'];
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
    inCombat: (globals.game?.combat?.combatants?.contents ?? []).some(
      (c) => c.tokenId === token.id
    ),
    unseen: UNSEEN.some((slug) => actor.hasCondition?.(slug) === true),
  };
}

const subjectOf = (token: TokenDocLike, globals: BandGlobals): BandSubject | null => {
  const view = viewOf(token, globals);
  return view === null ? null : readBandSubject(view, nameRules(globals));
};

/** The tokens an `updateActor` concerns: the synthetic actor's one token, or every token of a linked actor. */
export function subjectsForActor(actor: unknown, globals: BandGlobals): (BandSubject | null)[] {
  const doc = actor as ActorLike | null;
  const tokens =
    doc?.isToken === true
      ? [doc.token].filter((t): t is TokenDocLike => t !== null && t !== undefined)
      : (doc?.getActiveTokens?.(true, true) ?? []);
  return tokens.map((token) => subjectOf(token, globals));
}

export function combatSubjects(globals: BandGlobals): (BandSubject | null)[] {
  return (globals.game?.combat?.combatants?.contents ?? []).map((c) =>
    c.token ? subjectOf(c.token, globals) : null
  );
}
