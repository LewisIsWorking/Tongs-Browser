/**
 * The default token facing, as rules with no Foundry in them. Added 2026-11-14.
 *
 * Lewis: "I'd like every default token to be mirrored horizontally and vertically by default and
 * non-locked rotation." Mirrored on both axes, the art is turned half a circle, so a placed token sits at
 * rotation 180 to show it upright, and can still be turned to face where it is going.
 *
 * ⚠️ Mirroring keeps the size: a scale of 0.8 becomes -0.8, never -1, because PF2e's auto-scale and a
 *    GM's own choice both live in the magnitude.
 */
export const UPRIGHT_ROTATION = 180;

export interface TextureScale {
  readonly scaleX?: number;
  readonly scaleY?: number;
}

/** A prototype token, as far as facing goes. */
export interface PrototypeFacing {
  readonly texture?: TextureScale;
  readonly lockRotation?: boolean;
}

/** A placed token, as far as facing goes. */
export interface PlacedFacing {
  readonly texture?: TextureScale;
  readonly rotation?: number;
}

export interface FacingChange {
  readonly texture: { readonly scaleX: number; readonly scaleY: number };
  readonly lockRotation: false;
}

const mirrored = (scale: number | undefined): number => -Math.abs(scale ?? 1);

const isMirrored = (scale: number | undefined): boolean => (scale ?? 1) < 0;

/** What a prototype token becomes: mirrored both ways and free to turn. Null when it already is. */
export function facingChange(current: PrototypeFacing | undefined): FacingChange | null {
  const texture = current?.texture;
  if (
    isMirrored(texture?.scaleX) &&
    isMirrored(texture?.scaleY) &&
    current?.lockRotation === false
  ) {
    return null;
  }
  return {
    texture: { scaleX: mirrored(texture?.scaleX), scaleY: mirrored(texture?.scaleY) },
    lockRotation: false,
  };
}

/**
 * A NEW actor's prototype change. Null when whoever made it asked for a mirror themselves: their choice
 * stands, whichever axis it was on.
 */
export function newActorFacing(
  requested: PrototypeFacing | undefined,
  current: PrototypeFacing | undefined
): FacingChange | null {
  if (isMirrored(requested?.texture?.scaleX) || isMirrored(requested?.texture?.scaleY)) {
    return null;
  }
  return facingChange(current);
}

/** The rotation a new token is placed at: upright for art mirrored both ways. Null to leave it alone. */
export function uprightRotation(token: PlacedFacing): number | null {
  return isMirrored(token.texture?.scaleX) &&
    isMirrored(token.texture?.scaleY) &&
    (token.rotation ?? 0) === 0
    ? UPRIGHT_ROTATION
    : null;
}

/**
 * The scale a Prototype Token form left out, so its Mirror ticks are not lost. Null when nothing is lost.
 *
 * ⛔ PF2e 8.7 on Foundry 14.370: with PF2e's auto-scale on, the Scale slider is disabled, so the form
 *    submits no `scale`. Core only turns the Mirror ticks into `texture.scaleX`/`scaleY` when `scale` is
 *    a number, then deletes the ticks, and PF2e puts `scale` back only AFTER that. Every tick is dropped.
 *    Supplying the size PF2e itself would have used (the absolute saved scale) lets core keep them.
 * ⚠️ A no-op whenever `scale` arrives as a number, so a fix in PF2e or core makes this do nothing.
 */
export function missingScale(
  submitted: Readonly<Record<string, unknown>>,
  savedScaleX: number | undefined
): number | null {
  if (typeof submitted['scale'] === 'number') {
    return null;
  }
  if (!('mirrorX' in submitted) && !('mirrorY' in submitted)) {
    return null;
  }
  return Math.abs(savedScaleX ?? 1);
}
