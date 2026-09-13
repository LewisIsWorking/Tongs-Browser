/**
 * The tokens a GM can choose between when a card names nobody. Added 2026-09-14.
 *
 * ⚠️ The encounter first: when a combat is running on the scene being viewed, its combatants are the
 * creatures a save or a hit is about, and every token on a busy map is a long list to scroll. With no
 * combat here, every token on the scene.
 *
 * ⛔ GM ONLY, and an empty list for anyone else. Token names can be hidden from players, and this list
 * is only ever shown inside the GM's deck.
 *
 * ⚠️ Only the VIEWED scene. The deck selects tokens to aim PF2e at them, and only tokens on the scene
 * being viewed can be selected.
 */
export interface TokenCandidate {
  readonly tokenUuid: string;
  readonly name: string;
}

interface TokenDocLike {
  readonly uuid?: string;
  readonly name?: string;
}

interface CombatLike {
  readonly scene?: { readonly id?: string } | null;
  readonly combatants?: {
    readonly contents?: readonly { readonly token?: TokenDocLike | null }[];
  };
}

export interface CandidateGlobals {
  readonly game?: {
    readonly user?: { readonly isGM?: boolean };
    readonly combat?: CombatLike | null;
  };
  readonly canvas?: {
    readonly scene?: { readonly id?: string } | null;
    readonly tokens?: { readonly placeables?: readonly { readonly document?: TokenDocLike }[] };
  };
}

function asCandidates(docs: readonly (TokenDocLike | null | undefined)[]): TokenCandidate[] {
  const seen = new Set<string>();
  const candidates: TokenCandidate[] = [];
  for (const doc of docs) {
    if (typeof doc?.uuid === 'string' && typeof doc.name === 'string' && !seen.has(doc.uuid)) {
      seen.add(doc.uuid);
      candidates.push({ tokenUuid: doc.uuid, name: doc.name });
    }
  }
  return candidates;
}

export function readTokenCandidates(globals: CandidateGlobals): TokenCandidate[] {
  if (globals.game?.user?.isGM !== true) {
    return [];
  }
  const sceneId = globals.canvas?.scene?.id;
  const combat = globals.game.combat;
  if (sceneId !== undefined && combat?.scene?.id === sceneId) {
    const fighting = asCandidates((combat.combatants?.contents ?? []).map((each) => each.token));
    if (fighting.length > 0) {
      return fighting;
    }
  }
  return asCandidates((globals.canvas?.tokens?.placeables ?? []).map((token) => token.document));
}
