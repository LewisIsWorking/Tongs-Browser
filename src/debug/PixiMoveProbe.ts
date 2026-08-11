/**
 * Counts the pointermove events PIXI delivers to Foundry's token layer and to its stage.
 *
 * Extracted from TongsBrowser 2026-08-11, when that file was eight times over the 200 line limit.
 *
 * ⚠️ READ THIS BEFORE TRUSTING THE NUMBERS. The original comment on these counters claimed they
 * "separate the two remaining possibilities", on the reasoning that Foundry binds its drag move
 * handler on `this.layer`, so moves failing to reach the layer would explain a drag that never
 * starts. That reasoning is wrong, and the claim was disproved by measuring a drag that WORKS:
 *
 *   desktop, 12 steps, token moved   ->  layer=5  stage=39
 *   desktop, 150 steps, token moved  ->  layer=36 stage=177
 *   device, 235 moves, token stuck   ->  layer=87 stage=482
 *
 * All three are roughly one in ten. The ratio does not distinguish a working drag from a broken one
 * and never did, and a device's `layer=8` was read as a smoking gun on that false basis. The counts
 * are kept because a ZERO would still be meaningful, that being PIXI delivering nothing at all, but
 * any reading above zero says almost nothing on its own.
 */
export interface PixiMoveCounts {
  readonly layer: number;
  readonly stage: number;
  /**
   * Moves delivered to the controlled TOKEN itself, which is the count that matters.
   *
   * ⚠️ Foundry gates the start of a drag inside a handler bound on the OBJECT, not on the layer, and
   * PIXI delivers to an object only while the pointer is over it. So the gate is evaluated only
   * while the pointer is still standing on the token, and if it has not opened by the time the
   * pointer leaves, it never will.
   *
   * Every count here so far has been of the LAYER, which is a different thing and has been reported
   * as though it answered this. A layer count stays healthy while the object receives nothing.
   */
  readonly token: number;
  readonly attached: boolean;
  readonly tokenAttached: boolean;
}

interface EmitterLike {
  readonly on?: (event: string, handler: () => void) => void;
}

interface CanvasWithEmitters {
  readonly tokens?: EmitterLike & { readonly controlled?: EmitterLike[] };
  readonly stage?: EmitterLike;
}

export class PixiMoveProbe {
  private layerMoves = 0;
  private stageMoves = 0;
  private tokenMoves = 0;
  private attached = false;
  private tokenAttached = false;

  /** The token currently listened to, so a call per dispatch cannot stack listeners on it. */
  private watchedToken: EmitterLike | undefined = undefined;

  /**
   * The canvas is read through a getter so a test can supply one, rather than reached for on
   * `globalThis` where nothing can substitute it.
   */
  public constructor(private readonly getCanvas: () => CanvasWithEmitters | undefined) {}

  /**
   * Attach the layer and stage counters, once, lazily.
   *
   * Lazily because the canvas does not exist when the module is constructed, and once because these
   * are listeners on objects Foundry owns: a set per gesture would leak them across a scene change.
   */
  public attach(): void {
    if (this.attached) {
      return;
    }

    const canvas = this.getCanvas();
    const layer = canvas?.tokens;
    const stage = canvas?.stage;
    if (layer?.on === undefined || stage?.on === undefined) {
      // The canvas is not ready yet. Staying unattached means the next call tries again, which is
      // what makes this safe to call on every dispatch.
      return;
    }

    layer.on('pointermove', () => {
      this.layerMoves += 1;
    });
    stage.on('pointermove', () => {
      this.stageMoves += 1;
    });
    this.attached = true;
  }

  /**
   * Attach to the controlled token, separately and repeatedly.
   *
   * Separate from `attach` because the token is not there when the canvas is: it is whatever the
   * user has selected right now, and it changes. Re-attaching to the SAME token is guarded by
   * remembering the object, so a call per dispatch does not stack listeners on it.
   */
  public attachToControlledToken(): void {
    const token = this.getCanvas()?.tokens?.controlled?.[0];
    if (token?.on === undefined || token === this.watchedToken) {
      return;
    }
    this.watchedToken = token;
    this.tokenMoves = 0;
    token.on('pointermove', () => {
      this.tokenMoves += 1;
    });
    this.tokenAttached = true;
  }

  public getCounts(): PixiMoveCounts {
    return {
      layer: this.layerMoves,
      stage: this.stageMoves,
      token: this.tokenMoves,
      attached: this.attached,
      tokenAttached: this.tokenAttached,
    };
  }

  /** Reset for a fresh gesture. The attachment survives, since the listeners are still bound. */
  public resetCounts(): void {
    this.layerMoves = 0;
    this.stageMoves = 0;
    this.tokenMoves = 0;
  }
}
