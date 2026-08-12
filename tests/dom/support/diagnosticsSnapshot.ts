import type { DiagnosticsSnapshot } from '../../../src/debug/DiagnosticsReport.js';

/**
 * A complete diagnostics snapshot, with any field overridable. Extracted 2026-08-12 when the report
 * tests were split and both halves needed it.
 *
 * ⚠️ COMPLETE, and a factory rather than a constant. Every field is filled because the builder is
 * the thing under test and a partial fixture would let a missing field read as a passing assertion.
 * A factory because each caller mutates through `overrides`, and a shared constant would carry one
 * test's override into the next.
 */
export function snapshot(overrides: Partial<DiagnosticsSnapshot> = {}): DiagnosticsSnapshot {
  return {
    build: '0.24.3',
    tokenMovement: 'NO (100,100 -> 100,100)',
    releasedDuringDrag: true,
    grabbedOnToken: 'YES, on Anthony',
    pointerTravel: { recorded: true, peak: 120 },
    movesDispatched: 200,
    originDrift: { sampled: true, peak: 0, samples: 200 },
    dragGate: { sampled: true, peak: 120, samples: 200 },
    divergence: { sampled: true, peak: 0, samples: 400 },
    peakInteractionState: 4,
    peakPreviewCount: 1,
    viewport: { atGrab: '360x607', now: '360x607', resizes: 0 },
    journal: [],
    dragEndings: [],
    hooksInstalled: { token: true, manager: true },
    moves: { token: 90, layer: 90, stage: 400 },
    lastGateDistance: 120,
    pointerComparison: 'pixi=1,2 origin=3,4',
    touchCounts: { touchstart: 3, touchmove: 100 },
    manifestVersion: '0.2.3',
    enabled: true,
    isGm: true,
    paused: false,
    activeTool: 'select',
    controlledToken: 'Anthony at (100, 100)',
    canDrag: 'true',
    pointer: { x: 10.4, y: 20.6, dragging: false },
    elementUnderPointer: 'canvas#board',
    pixiMousePosition: '(50, 60)',
    insideSelectedToken: true,
    canvasReady: 'true',
    keyboardStrategy: 'events',
    interactionStateNow: 'NONE (0)',
    probeAttached: true,
    userAgent: 'test agent',
    recentDispatches: [],
    ...overrides,
  };
}

/** The one line matching a needle, for asserting what the report says rather than that it said something. */
export const find = (lines: string[], needle: string) =>
  lines.find((line) => line.includes(needle));
