import { BASE } from '../foundry-session.ts';

/**
 * Saying what the drag did, in terms somebody can act on. Extracted from foundry-drag-check
 * 2026-08-12.
 */
export const format = (point: { x: number; y: number }) =>
  `(${String(point.x)}, ${String(point.y)})`;

/**
 * Everything the check measured. Loose on purpose: the shape is built inside `page.evaluate` where
 * Foundry's own untyped API supplies most of it, so a strict interface here would be a second,
 * drifting description of a thing the page already decides.
 */
export interface DragCheckResult {
  before: { x: number; y: number };
  after: { x: number; y: number };
  moved: boolean;
  travelled: number;
  expected: number;
  scale: number;
  peakState: number;
  peakClones: number;
  centre: { x: number; y: number };
  client: { x: number; y: number };
  hitDescription: string;
  controlledAtStart: number;
  controlled: number;
  activeTool: string;
  locked: boolean;
  pointerStillDragging: boolean;
  layerMoves: number;
  stageMoves: number;
  originAliasesPointer: boolean | null;
  trace: {
    step: number;
    ours: number;
    origin: number | null;
    destination: number | null;
    clone: number | null;
    state: number;
  }[];
}

export function report(result: DragCheckResult) {
  console.log(`Foundry at ${BASE}`);
  console.log(`  token position : ${format(result.before)} -> ${format(result.after)}`);
  console.log(`  moved          : ${result.moved ? 'YES' : 'NO'}`);
  console.log(
    `  travelled      : ${result.travelled.toFixed(1)} of an expected ${result.expected.toFixed(1)} canvas px (scale ${result.scale.toFixed(2)})`
  );
  console.log(`  peak state     : ${String(result.peakState)} (4 is DRAG)`);
  console.log(`  drag clones    : ${String(result.peakClones)}`);
  console.log(`  token centre   : ${format(result.centre)} in canvas space`);
  console.log(`  press point    : ${format(result.client)} in client space`);
  console.log(`  element there  : ${result.hitDescription}`);
  console.log(
    `  controlled     : ${String(result.controlledAtStart)} at start, ${String(result.controlled)} at end`
  );
  console.log(`  active tool    : ${String(result.activeTool)}`);
  console.log(`  token locked   : ${String(result.locked)}`);
  console.log(`  still dragging : ${String(result.pointerStillDragging)}`);
  console.log(
    `  PIXI moves     : layer=${String(result.layerMoves)} stage=${String(result.stageMoves)}` +
      ` (a device reported layer=8 stage=112 on a drag that failed)`
  );
  console.log(
    `  origin aliases PIXI pointer: ${String(result.originAliasesPointer)}` +
      (result.originAliasesPointer === true
        ? '  <-- any hypot(pointer - screenOrigin) is structurally 0.0'
        : '')
  );
  console.log('  per step (ours / screenOrigin / destination / clone x / state):');
  for (const entry of result.trace) {
    console.log(
      `    ${String(entry.step).padStart(2)}: ${String(entry.ours).padStart(5)} / ` +
        `${String(entry.origin).padStart(5)} / ${String(entry.destination).padStart(5)} / ` +
        `${String(entry.clone).padStart(5)} / ${String(entry.state)}`
    );
  }
}
