/**
 * Read only probes into Foundry and PIXI, for the diagnostics report.
 *
 * Extracted from TongsBrowser 2026-08-11, when that file reached 1,691 lines against a hard 200
 * line limit, almost all of it diagnostics grown one device report at a time.
 *
 * These are pure functions over global state rather than methods, because none of them needs the
 * module: each asks Foundry or PIXI a question and turns the answer into a sentence. That also
 * makes them testable by handing over a fake globalThis, which methods on the composition root
 * never were.
 */
/** Matches MouseInteractionManager.INTERACTION_STATES in Foundry 14. */
export const INTERACTION_STATE_NAMES = ['NONE', 'HOVER', 'CLICKED', 'GRABBED', 'DRAG', 'DROP'];

/**
 * PIXI's pointer beside Foundry's recorded drag origin.
 *
 * Foundry gates the drag on the distance between `event.global` and `screenOrigin`, and a device
 * measured that as exactly 0.0px across eleven moves. Printing both, plus the canvas rect PIXI maps
 * through, makes a mapping failure visible rather than inferred.
 */
export function describePointers(): string {
  const canvasGlobal = (
    globalThis as {
      canvas?: {
        app?: {
          view?: { getBoundingClientRect?: () => DOMRect };
          renderer?: {
            events?: { pointer?: { global?: { x: number; y: number } } };
            resolution?: number;
          };
        };
        tokens?: {
          controlled?: {
            mouseInteractionManager?: {
              interactionData?: { screenOrigin?: { x: number; y: number } };
            };
          }[];
        };
      };
    }
  ).canvas;

  const pixi = canvasGlobal?.app?.renderer?.events?.pointer?.global;
  const origin =
    canvasGlobal?.tokens?.controlled?.[0]?.mouseInteractionManager?.interactionData?.screenOrigin;
  const rect = canvasGlobal?.app?.view?.getBoundingClientRect?.();

  const parts = [
    `pixi=${pixi === undefined ? 'n/a' : `${String(Math.round(pixi.x))},${String(Math.round(pixi.y))}`}`,
    `origin=${origin === undefined ? 'n/a' : `${String(Math.round(origin.x))},${String(Math.round(origin.y))}`}`,
    `viewRect=${rect === undefined ? 'n/a' : `${String(Math.round(rect.x))},${String(Math.round(rect.y))} ${String(Math.round(rect.width))}x${String(Math.round(rect.height))}`}`,
    `res=${String(canvasGlobal?.app?.renderer?.resolution ?? 'n/a')}`,
  ];
  return parts.join(' ');
}

/**
 * Whether the pointer is standing on the controlled token, judged at the moment of the grab.
 *
 * Foundry begins a drag from a pointerdown that HITS a placeable. A press a few pixels off the token
 * starts a selection rectangle instead: no origin is recorded, the interaction peaks at HOVER, and
 * every number in the report is then correct about a gesture nobody meant to perform.
 *
 * The bounds come from the token's own document rather than from a hit test, because a hit test asks
 * PIXI what is under the pointer NOW and this needs to be answered later, in a report. Width and
 * height are in grid squares in Foundry's data model, so they are multiplied by the grid size.
 */
export function describeGrabTarget(): string {
  const canvasGlobal = (
    globalThis as {
      canvas?: {
        mousePosition?: { x: number; y: number };
        grid?: { size?: number };
        tokens?: {
          controlled?: {
            name?: string;
            document?: { x?: number; y?: number; width?: number; height?: number };
          }[];
        };
      };
    }
  ).canvas;

  const token = canvasGlobal?.tokens?.controlled?.[0];
  const doc = token?.document;
  const at = canvasGlobal?.mousePosition;

  if (doc?.x === undefined || doc.y === undefined || at === undefined) {
    return 'no controlled token, so there was nothing to grab';
  }

  const grid = canvasGlobal?.grid?.size ?? 100;
  const right = doc.x + (doc.width ?? 1) * grid;
  const bottom = doc.y + (doc.height ?? 1) * grid;
  const inside = at.x >= doc.x && at.x <= right && at.y >= doc.y && at.y <= bottom;

  const name = token?.name ?? 'the token';

  if (inside) {
    return `YES, on ${name}`;
  }

  const dx = at.x < doc.x ? doc.x - at.x : at.x > right ? at.x - right : 0;
  const dy = at.y < doc.y ? doc.y - at.y : at.y > bottom ? at.y - bottom : 0;
  return (
    `NO, the pointer was ${String(Math.round(Math.hypot(dx, dy)))} canvas px OUTSIDE ` +
    `${name}. Put the cursor ON the token before grabbing.`
  );
}

/** Foundry's own view of where an interaction got to, named rather than left as a bare number. */
export function describeInteractionState(target: unknown): string {
  const manager = (target as { mouseInteractionManager?: { state?: number } } | undefined)
    ?.mouseInteractionManager;
  if (manager?.state === undefined) {
    return 'no interaction manager';
  }
  return `${INTERACTION_STATE_NAMES[manager.state] ?? 'UNKNOWN'} (${String(manager.state)})`;
}

/**
 * What Foundry's own permission checks say about dragging this token.
 *
 * ⚠️ `#handleDragStart` is the ONE cancel path that fires on something other than a pointerup:
 *
 *     if ( !this.can(action, event) ) {
 *       this.#debug(action, event, this.handlerOutcomes.DISALLOWED);
 *       this.cancel(event);
 *       return;
 *     }
 *
 * So a refused `dragLeftStart` cancels the whole interaction, and nothing else in the report would
 * say so: the state, the gate and the origin all look exactly as they do for any other cancel. This
 * asks the manager directly rather than inferring it from a stack frame.
 *
 * `dragStart` is asked as well, because it gates a DIFFERENT thing: `#handleClickLeft` only reaches
 * GRABBED and binds the drag handlers when `can("dragStart")` passes. One false and the other true
 * are two different failures.
 */
export function describeDragPermissions(target: unknown): string {
  const manager = (
    target as { mouseInteractionManager?: { can?: (a: string, e: unknown) => boolean } } | undefined
  )?.mouseInteractionManager;
  const can = manager?.can;
  if (can === undefined) {
    return 'no manager to ask';
  }

  /*
   * A bare object rather than a real event. Foundry's permission callbacks take the event but the
   * ones that matter here read the user and the object, not the event, and constructing a federated
   * event outside PIXI is not possible from here. If a check ever does read it, this says so by
   * throwing rather than by quietly answering the wrong question.
   */
  const probe = { type: 'pointermove', button: 0 };
  const answers = ['clickLeft', 'dragStart', 'dragLeftStart'].map((action) => {
    try {
      return `${action}=${String(can.call(manager, action, probe))}`;
    } catch (error) {
      /*
       * ⚠️ The MESSAGE, not the bare word `unaskable`, and the difference cost a device round trip.
       *
       * `dragLeftStart=unaskable` was reported by a phone and said only "the probe threw", which is
       * the one thing already obvious from the word. The message names the field the check read and
       * this probe did not supply, which is the actual answer.
       *
       * Deliberately NOT fixed by enriching the probe until that message says what to enrich it
       * with. Adding fields to make a probe stop throwing is how a probe starts reporting healthy
       * every time, and a permission check that answers the wrong question is worse than one that
       * refuses to answer.
       */
      const message = error instanceof Error ? error.message : String(error);
      return `${action}=unaskable(${message.slice(0, 60)})`;
    }
  });
  return answers.join(' ');
}
