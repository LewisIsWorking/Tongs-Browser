import type { SampledPeak } from './DiagnosticsReport.js';

/**
 * What goes into a drag measurement and what comes out. Extracted from DragSampler 2026-08-12.
 *
 * Its own file so the sampler stays the arithmetic and this stays the contract. Both are read by
 * people trying to work out what a number in a report means, and that is easier when the shape is
 * not buried under the code that fills it in.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface DragSample {
  readonly interactionState?: number | undefined;
  readonly previewCount?: number | undefined;
  /** Foundry's recorded drag origin, in screen space, or undefined when it is not readable. */
  readonly foundryOrigin?: Point | undefined;
  /** PIXI's own pointer, which is what Foundry measures its drag gate against. */
  readonly pixiPointer?: Point | undefined;
  /** Where our virtual pointer is, which is the only position Foundry cannot confound. */
  readonly ourPointer?: { readonly clientX: number; readonly clientY: number } | undefined;
}

export interface DragSnapshot {
  readonly peakInteractionState: number;
  readonly peakPreviewCount: number;
  readonly movesDispatched: number;
  readonly originDrift: SampledPeak;
  readonly dragGate: SampledPeak;
  readonly divergence: SampledPeak;
  readonly lastGateDistance: number;
  readonly travel: { readonly recorded: boolean; readonly peak: number };
}
