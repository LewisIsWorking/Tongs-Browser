import { installFoundryDragHooks } from './FoundryDragHooks.js';
import { PixiMoveProbe } from './PixiMoveProbe.js';

/**
 * The listeners that watch a drag happen. Extracted from DragDiagnostics 2026-08-12.
 *
 * All three are installed ONCE and left in place, never added per gesture. Two reasons, and both
 * were learned the hard way: a set of listeners per gesture leaks them across a scene change, and a
 * diagnostic that has to be installed during the bug is a diagnostic nobody has when the bug happens.
 */
export interface DragObserverPort {
  readonly window: Window;
  /** Whether a drag record is currently open, so nothing is counted outside one. */
  readonly isCapturing: () => boolean;
}

export class DragObservers {
  public constructor(private readonly options: DragObserverPort) {
    this.bindResizeCounter();
  }

  /**
   * How many pointermove events PIXI delivered to the token LAYER during this gesture.
   *
   * This is the measurement that separates the two remaining possibilities, and it exists because
   * Foundry's MouseInteractionManager binds the drag's move handler on `this.layer`, not on the
   * object and not on the DOM:
   *
   *     this.layer.on("pointermove", this.#handlers.pointermove)
   *
   * A device reported peaking at GRABBED, which proves pointerdown DID reach the token through PIXI,
   * so PIXI delivery works for the press. GRABBED advances to DRAG only when moves reach the layer.
   * Counting them says whether PIXI is delivering them at all, which is a completely different fix
   * from the layer receiving them and declining to act.
   */
  private readonly pixiProbe = new PixiMoveProbe(() => (globalThis as { canvas?: never }).canvas);

  /**
   * Which of Foundry's two drag endings actually ran: the DROP, or the CANCEL.
   *
   * ⚠️ The drag now reaches DRAG with a preview clone and the token still does not move, so the
   * failure has moved from the gate to the ending. Those are two different handlers on Foundry's
   * Token, and every number in this report is silent about which one fired:
   *
   *   _onDragLeftDrop   -> reads interactionData.clones and writes the new position
   *   _onDragLeftCancel -> destroys the preview and writes nothing
   *
   * They are indistinguishable from outside. Both leave the state reset, both leave no preview, and
   * both leave the token where it was if the drop refuses. Wrapping them is the only way to see it,
   * and it is done once and left in place because a diagnostic that has to be installed during the
   * bug is a diagnostic nobody has when the bug happens.
   */
  private dragEndings: string[] = [];
  private hooksInstalled = { token: false, manager: false };

  /**
   * Viewport resizes during the drag, and the size at the grab.
   *
   * The suspected cause of the redraws that cancel the interaction. On Android the URL bar slides in
   * and out as you gesture, and that resizes the viewport; Foundry redraws the canvas on resize, and
   * a redraw of a token cancels its interaction outright. A desktop window simply does not change
   * size mid drag, which would explain why every desktop run passes.
   *
   * Counted rather than argued about. If this is zero while the redraws are not, the hypothesis is
   * dead and the cause is something else entirely.
   */
  private resizesDuringDrag = 0;
  private viewportAtGrab = '';

  /**
   * Count viewport resizes, always, so the count is already running when a drag starts.
   *
   * Bound once for the module's lifetime rather than per drag: a listener added at the grab would
   * miss a resize triggered by the grab itself, which is precisely the case under suspicion.
   */
  private bindResizeCounter(): void {
    this.options.window.addEventListener('resize', () => {
      if (this.options.isCapturing()) {
        this.resizesDuringDrag += 1;
      }
    });
  }

  /**
   * Attach the PIXI move counters, retrying until the canvas and a controlled token exist.
   *
   * The counting lives in debug/PixiMoveProbe.ts, which was written and covered days before this
   * call site existed: the class was extracted and then never wired in, so the composition root
   * kept its own duplicate of the same logic. Two copies of a counter is two things to get subtly
   * wrong, and only one of them had tests.
   */
  private attachPixiProbe(): void {
    this.pixiProbe.attach();
    this.pixiProbe.attachToControlledToken();
  }

  /**
   * Install the Foundry observers, retrying until the canvas exists.
   *
   * The logic lives in debug/FoundryDragHooks.ts; this only supplies the prototypes and collects the
   * observations, which is all a composition root should be doing.
   */
  private hookDragEndings(): void {
    if (this.hooksInstalled.token && this.hooksInstalled.manager) {
      return;
    }
    const global = globalThis as {
      CONFIG?: { Token?: { objectClass?: { prototype?: Record<string, unknown> } } };
      canvas?: {
        tokens?: {
          controlled?: {
            mouseInteractionManager?: { constructor?: { prototype?: Record<string, unknown> } };
          }[];
        };
      };
    };

    this.hooksInstalled = installFoundryDragHooks({
      getTokenPrototype: () => global.CONFIG?.Token?.objectClass?.prototype,
      getManagerPrototype: () =>
        global.canvas?.tokens?.controlled?.[0]?.mouseInteractionManager?.constructor?.prototype,
      isRecording: () => this.options.isCapturing(),
      onObservation: (note) => this.dragEndings.push(note),
    });
  }

  /** What the observers saw, for the report. */
  public snapshot(): {
    readonly dragEndings: readonly string[];
    readonly hooksInstalled: { token: boolean; manager: boolean };
    readonly resizes: number;
    readonly viewportAtGrab: string;
    readonly counts: ReturnType<PixiMoveProbe['getCounts']>;
  } {
    return {
      dragEndings: this.dragEndings,
      hooksInstalled: this.hooksInstalled,
      resizes: this.resizesDuringDrag,
      viewportAtGrab: this.viewportAtGrab,
      /*
       * ⚠️ Read ONCE. `getCounts` returns a fresh object each call and the listeners behind it fire
       * continuously while the pointer moves, so separate calls put separate fields at separate
       * moments and the report can disagree with itself about one gesture.
       */
      counts: this.pixiProbe.getCounts(),
    };
  }

  /** Open a fresh window: the counters and observations belong to one drag at a time. */
  public beginDrag(viewport: string): void {
    this.pixiProbe.resetCounts();
    this.dragEndings = [];
    this.resizesDuringDrag = 0;
    this.viewportAtGrab = viewport;
  }

  /** Attach whatever is attachable now, retrying until the canvas and a token exist. */
  public attach(): void {
    this.attachPixiProbe();
    this.hookDragEndings();
  }
}
