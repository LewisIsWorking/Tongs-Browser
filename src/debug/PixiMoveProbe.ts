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
  readonly attached: boolean;
}

interface EmitterLike {
  readonly on?: (event: string, handler: () => void) => void;
}

interface CanvasWithEmitters {
  readonly tokens?: EmitterLike;
  readonly stage?: EmitterLike;
}

export class PixiMoveProbe {
  private layerMoves = 0;
  private stageMoves = 0;
  private attached = false;

  /**
   * Attach the counters, once, lazily.
   *
   * Lazily because the canvas does not exist when the module is constructed, and once because these
   * are listeners on objects Foundry owns: a set per gesture would leak them across a scene change.
   *
   * The canvas is read through a getter so a test can supply one, rather than reached for on
   * `globalThis` where nothing can substitute it.
   */
  public constructor(private readonly getCanvas: () => CanvasWithEmitters | undefined) {}

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

  public getCounts(): PixiMoveCounts {
    return { layer: this.layerMoves, stage: this.stageMoves, attached: this.attached };
  }

  /** Reset for a fresh gesture. The attachment survives, since the listeners are still bound. */
  public resetCounts(): void {
    this.layerMoves = 0;
    this.stageMoves = 0;
  }
}
