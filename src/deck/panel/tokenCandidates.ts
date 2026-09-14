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
 *
 * ⛔ SAME-NAMED TOKENS ARE NUMBERED, found live on SF2e 2026-09-14: two copies of one creature read
 * "Roll Will DC 23 for Robotic Advanced War Machine and Robotic Advanced War Machine", and four
 * "Goblin Warrior" rows would be four identical buttons. Each duplicate gets a number in scene order,
 * and every row carries HP, which is how a GM tells the wounded goblin from the fresh one.
 *
 * ⚠️ A token whose creature is gone is left out. It cannot take damage or roll, so offering it could
 * only end in a wait and "PF2e never reported", which is what the same live run did.
 */
export interface TokenCandidate {
  readonly tokenUuid: string;
  /** Unique among the candidates: "Goblin Warrior 2" when there is more than one. */
  readonly name: string;
  /** "12/15 HP", or null when the creature has no hit points to show. */
  readonly hp: string | null;
}

interface TokenDocLike {
  readonly uuid?: string;
  readonly name?: string;
  readonly actor?: {
    readonly system?: { readonly attributes?: { readonly hp?: { value?: number; max?: number } } };
  } | null;
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

function hpOf(doc: TokenDocLike): string | null {
  const hp = doc.actor?.system?.attributes?.hp;
  return typeof hp?.value === 'number' && typeof hp.max === 'number'
    ? `${String(hp.value)}/${String(hp.max)} HP`
    : null;
}

function asCandidates(docs: readonly (TokenDocLike | null | undefined)[]): TokenCandidate[] {
  const seen = new Set<string>();
  const found: { tokenUuid: string; name: string; hp: string | null }[] = [];
  for (const doc of docs) {
    const usable = typeof doc?.uuid === 'string' && typeof doc.name === 'string' && !!doc.actor;
    if (usable && !seen.has(doc.uuid)) {
      seen.add(doc.uuid);
      found.push({ tokenUuid: doc.uuid, name: doc.name, hp: hpOf(doc) });
    }
  }
  const total = new Map<string, number>();
  found.forEach((each) => total.set(each.name, (total.get(each.name) ?? 0) + 1));
  const numbered = new Map<string, number>();
  return found.map((each) => {
    if (total.get(each.name) === 1) {
      return each;
    }
    const n = (numbered.get(each.name) ?? 0) + 1;
    numbered.set(each.name, n);
    return { ...each, name: `${each.name} ${String(n)}` };
  });
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
