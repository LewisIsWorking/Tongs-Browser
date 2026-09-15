/**
 * The encounters a token is fighting in, whichever one the GM's tracker is showing. Added 2026-09-15.
 *
 * ⛔ FOUND LIVE ON FORGE, 2026-09-15. Everything read `game.combat`, which is the ONE encounter the
 * combat tracker is showing. A play-by-post world runs several at once (Lewis's had four tabs), so with
 * the tracker on encounter 1, a player's hit on an enemy in encounter 4 was sent to the roll deck as
 * "not in a running combat" and its health band was never posted. Nothing about a hit depends on which
 * tab a GM last clicked, so every encounter in the world is searched.
 *
 * ⚠️ A token is matched by its scene AND its id when the combatant names a scene: token ids are only
 * unique within a scene.
 *
 * ⚠️ STARTED ENCOUNTERS FIRST. A token prepared into a second encounter that has not begun belongs to the
 * one being fought.
 */
export interface CombatantRef {
  readonly tokenId?: string;
  readonly sceneId?: string;
}

export interface CombatRef<C extends CombatantRef = CombatantRef> {
  readonly id?: string;
  readonly started?: boolean;
  readonly combatants?: { readonly contents?: readonly C[] };
}

export interface CombatsGlobals<C extends CombatantRef = CombatantRef> {
  readonly game?: {
    readonly combats?: { readonly contents?: readonly CombatRef<C>[] } | null;
  };
}

/** Every combatant of every encounter in the world, with its encounter. */
export function allCombatants<C extends CombatantRef>(
  globals: CombatsGlobals<C>
): { readonly combat: CombatRef<C>; readonly combatant: C }[] {
  return (globals.game?.combats?.contents ?? []).flatMap((combat) =>
    (combat.combatants?.contents ?? []).map((combatant) => ({ combat, combatant }))
  );
}

/** The encounters this token is in, started ones first. */
export function combatsWithToken<C extends CombatantRef>(
  globals: CombatsGlobals<C>,
  sceneId: string,
  tokenId: string
): CombatRef<C>[] {
  const found = allCombatants(globals)
    .filter(
      ({ combatant }) =>
        combatant.tokenId === tokenId &&
        (combatant.sceneId === undefined || combatant.sceneId === sceneId)
    )
    .map(({ combat }) => combat);
  return [...new Set(found)].sort(
    (a, b) => Number(b.started === true) - Number(a.started === true)
  );
}
