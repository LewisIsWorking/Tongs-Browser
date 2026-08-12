import { summariseDragEndings } from './FoundryDragHooks.js';

/**
 * Turns a snapshot of the drag into the lines the report prints. Extracted 2026-08-12.
 *
 * Pure: it reads nothing and asks nobody, it only formats what it is handed. That is what makes the
 * report testable at all, and this report has been wrong about its own numbers often enough to need
 * it. Three separate times a line here stated something the code had not measured, and each one sent
 * the investigation somewhere it did not need to go.
 *
 * ⚠️ The ORDER is load bearing and is not narrative. A phone chat window shows roughly fifteen lines
 * and silently truncates the rest, and an earlier report was cut off exactly at the field the whole
 * round existed to read. Lines are ordered by how much each one discriminates, most decisive first.
 */

/** How thin is too thin for a peak to describe a gesture, as a fraction of the moves dispatched. */
const THIN_SAMPLE_RATIO = 0.1;

/** Foundry's MouseInteractionManager states, by index. */
const STATE_NAMES = ['NONE', 'HOVER', 'CLICKED', 'GRABBED', 'DRAG', 'DROP'];

/** One sampled peak, with the count that says whether it describes anything. */
export interface SampledPeak {
  readonly sampled: boolean;
  readonly peak: number;
  readonly samples: number;
}

export interface DiagnosticsSnapshot {
  readonly build: string;
  readonly tokenMovement: string;
  readonly releasedDuringDrag: boolean;
  readonly grabbedOnToken: string | null;
  readonly pointerTravel: { readonly recorded: boolean; readonly peak: number };
  readonly movesDispatched: number;
  readonly originDrift: SampledPeak;
  readonly dragGate: SampledPeak;
  readonly divergence: SampledPeak;
  readonly peakInteractionState: number;
  readonly peakPreviewCount: number;
  readonly viewport: { readonly atGrab: string; readonly now: string; readonly resizes: number };
  readonly dragEndings: readonly string[];
  readonly moves: { readonly token: number; readonly layer: number; readonly stage: number };
  readonly lastGateDistance: number;
  readonly pointerComparison: string;
  readonly touchCounts: Readonly<Record<string, number>>;
  readonly manifestVersion: string;
  readonly enabled: boolean;
  readonly isGm: boolean;
  readonly paused: boolean;
  readonly activeTool: string;
  readonly controlledToken: string;
  readonly canDrag: string;
  readonly pointer: { readonly x: number; readonly y: number; readonly dragging: boolean };
  readonly elementUnderPointer: string;
  readonly pixiMousePosition: string;
  readonly insideSelectedToken: boolean;
  readonly canvasReady: string;
  readonly keyboardStrategy: string;
  readonly interactionStateNow: string;
  readonly probeAttached: boolean;
  readonly userAgent: string;
  readonly recentDispatches: readonly string[];
}

/**
 * Render a peak, or refuse to, saying which and why.
 *
 * The refusal matters more than the number. A confidently printed `0.0px` was read as "the pointer
 * never moved" three separate times. ⚠️ And the reason it was thin is NOT that Foundry's
 * `interactionData` is transient, which this report claimed for three releases: it is a plain
 * property that persists until `reset()`. Thin sampling means the data was being WIPED mid gesture,
 * which is a finding rather than a measurement error.
 */
export function describeThinly(reading: SampledPeak, moves: number): string {
  if (!reading.sampled) {
    return 'NOT MEASURABLE, Foundry never exposed a drag origin (this is not a distance of zero)';
  }
  const text = `${reading.peak.toFixed(1)}px over ${String(reading.samples)} samples`;
  if (moves <= 0 || reading.samples >= moves * THIN_SAMPLE_RATIO) {
    return text;
  }
  return (
    `${text} of ${String(moves)} moves. <em>Foundry's interactionData was readable for almost none ` +
    `of the gesture. It persists until reset(), so this means it was being WIPED mid drag. See the ` +
    `drag ending line for what did it.</em>`
  );
}

/** The decisive lines, ordered by how much each one discriminates. */
function buildHeadline(snapshot: DiagnosticsSnapshot): string[] {
  return [
    `<strong>Tongs Browser BUILD ${snapshot.build}</strong>`,
    `<strong>DID IT MOVE: ${snapshot.tokenMovement}</strong>`,
    `<strong>released during drag: ${String(snapshot.releasedDuringDrag)}${
      snapshot.releasedDuringDrag ? '' : ' <em>(tap the hand OFF before tapping this)</em>'
    }</strong>`,
    `<strong>GRABBED ON THE TOKEN: ${snapshot.grabbedOnToken ?? 'no grab recorded yet'}</strong>`,
    `<strong>OUR pointer travelled: ${
      snapshot.pointerTravel.recorded
        ? `${snapshot.pointerTravel.peak.toFixed(1)}px from the grab point${
            snapshot.pointerTravel.peak < 10
              ? " <em>(under Foundry's 10px threshold, so no drag can start: move further)</em>"
              : ' <em>(far enough, so the gate below should have opened)</em>'
          }`
        : 'no grab recorded'
    }</strong>`,
    `<strong>drag moves dispatched: ${String(snapshot.movesDispatched)}</strong>`,
  ];
}

/** What Foundry made of the gesture, which is where every remaining question lives. */
function buildFoundryView(snapshot: DiagnosticsSnapshot): string[] {
  return [
    `<strong>Foundry's drag ORIGIN drifted: ${describeThinly(snapshot.originDrift, snapshot.movesDispatched)}</strong>`,
    `<strong>DRAG GATE: ${describeThinly(snapshot.dragGate, snapshot.movesDispatched)}${
      snapshot.dragGate.samples > 0 ? ', needs >= 10' : ''
    }</strong>`,
    `<strong>ours vs PIXI during the drag: ${
      snapshot.divergence.sampled
        ? `${snapshot.divergence.peak.toFixed(1)}px apart at worst over ${String(snapshot.divergence.samples)} samples${
            snapshot.divergence.peak > 20
              ? ' <em>(PIXI IS NOT TRACKING OUR POINTER, so canvas.mousePosition below describes your finger)</em>'
              : ''
          }`
        : 'not measurable'
    }</strong>`,
    `<strong>PEAK state: ${STATE_NAMES[snapshot.peakInteractionState] ?? 'UNKNOWN'} (${String(snapshot.peakInteractionState)}), previews ${String(snapshot.peakPreviewCount)}</strong>`,
    `<strong>viewport: ${snapshot.viewport.atGrab} at the grab, ${snapshot.viewport.now} now, ${String(snapshot.viewport.resizes)} resizes during the drag${
      snapshot.viewport.resizes > 0
        ? ' <em>(a resize redraws the canvas, and redrawing a token CANCELS its interaction)</em>'
        : ''
    }</strong>`,
    `<strong>FOUNDRY'S DRAG ENDING: ${summariseDragEndings(snapshot.dragEndings)}</strong>`,
    // TOKEN first: Foundry checks its drag gate in a handler on the object, so a zero here means the
    // gate was never evaluated after the press and no amount of travel could have opened it.
    `<strong>PIXI moves TO THE TOKEN: ${String(snapshot.moves.token)}${
      snapshot.moves.token === 0
        ? ' <em>(ZERO. Foundry checks its drag gate on the token itself, so it was never checked.)</em>'
        : ''
    }</strong>`,
    `PIXI moves elsewhere: layer=${String(snapshot.moves.layer)} stage=${String(snapshot.moves.stage)} <em>(neither distinguishes a working drag from a broken one)</em>`,
  ];
}

/** The standing context: settings, selection and environment. */
function buildContext(snapshot: DiagnosticsSnapshot): string[] {
  return [
    `last gate distance: ${Number.isNaN(snapshot.lastGateDistance) ? 'NaN (origin or pointer missing)' : snapshot.lastGateDistance.toFixed(1)}`,
    `<strong>ours vs PIXI: ${snapshot.pointerComparison}</strong>`,
    `<strong>touch input (cumulative): ${
      Object.entries(snapshot.touchCounts)
        .map(([type, count]) => `${type}=${String(count)}`)
        .join(' ') || 'none'
    }</strong>`,
    `build: ${snapshot.build} (manifest says ${snapshot.manifestVersion}, stale if they differ)`,
    `enabled: ${String(snapshot.enabled)} | isGM: ${String(snapshot.isGm)} | paused: ${String(snapshot.paused)}`,
    `activeTool: ${snapshot.activeTool} <em>(dragging a token needs "select")</em>`,
    `controlled token: ${snapshot.controlledToken}`,
    `token._canDrag: ${snapshot.canDrag}`,
    `pointer: (${String(Math.round(snapshot.pointer.x))}, ${String(Math.round(snapshot.pointer.y))}) dragging: ${String(snapshot.pointer.dragging)}`,
    `element under pointer: ${snapshot.elementUnderPointer}`,
    // Labelled as PIXI's, because it is. Foundry derives mousePosition from PIXI's pointer, so where
    // PIXI is not tracking us this describes the finger and not the virtual pointer.
    `canvas.mousePosition (PIXI's pointer, NOT ours): ${snapshot.pixiMousePosition} insideSelectedToken: ${String(snapshot.insideSelectedToken)}`,
    `canvas ready: ${snapshot.canvasReady} | keyboard: ${snapshot.keyboardStrategy}`,
    `interaction state now: ${snapshot.interactionStateNow} (probe attached: ${String(snapshot.probeAttached)})`,
    `agent: ${snapshot.userAgent}`,
    `<strong>last ${String(snapshot.recentDispatches.length)} events dispatched</strong> <em>(grab, drag, drop, THEN tap this)</em>`,
    snapshot.recentDispatches.length === 0
      ? 'none yet'
      : snapshot.recentDispatches.map((line) => `<code>${line}</code>`).join('<br>'),
  ];
}

export function buildDiagnosticsReport(snapshot: DiagnosticsSnapshot): string[] {
  return [...buildHeadline(snapshot), ...buildFoundryView(snapshot), ...buildContext(snapshot)];
}

/** The same report as plain text, for the clipboard. */
export function toPlainText(lines: readonly string[]): string {
  return lines
    .join('\n')
    .replace(/<br>/g, '\n')
    .replace(/<[^>]+>/g, '');
}
