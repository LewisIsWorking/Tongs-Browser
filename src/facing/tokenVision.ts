/**
 * The default token vision, as rules with no Foundry in them. Added 2026-11-18.
 *
 * Lewis: "Can we also set vision to be enabled on all tokens and set their vision is 160°?" Most of C06's
 * party already sat at 160, set by hand; two sat at Foundry's 360 and one map came out wrong. The Nudge
 * bot's /map draws what the party's tokens can see, so a token's cone now matters outside Foundry too.
 *
 * ⚠️ Only Foundry's own 360 becomes 160. Any other angle was chosen by someone and stays.
 * ⚠️ PF2e switches vision ON only for characters and familiars and OFF for NPCs, hazards and loot (its
 *    actor `_preCreate`). This switches it on for every token, as asked. A GM sees everything anyway, and a
 *    player only sees through tokens they can observe, so an enemy's vision changes nothing for players.
 * ⚠️ Range is left alone: with PF2e's rules-based vision, the senses on the sheet decide it.
 */
export const DEFAULT_VISION_ANGLE = 160;

/** Foundry's default angle: a full circle, meaning nobody chose one. */
const FULL_CIRCLE = 360;

export interface SightFacing {
  readonly sight?: { readonly enabled?: boolean; readonly angle?: number };
}

export interface VisionChange {
  readonly sight: { readonly enabled: true; readonly angle: number };
}

/** What a token's vision becomes: on, at 160 unless an angle was chosen. Null when it already is. */
export function visionChange(current: SightFacing | undefined): VisionChange | null {
  const angle = current?.sight?.angle ?? FULL_CIRCLE;
  const wanted = angle === FULL_CIRCLE ? DEFAULT_VISION_ANGLE : angle;
  if (current?.sight?.enabled === true && angle === wanted) {
    return null;
  }
  return { sight: { enabled: true, angle: wanted } };
}
