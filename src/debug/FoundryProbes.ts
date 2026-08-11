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
