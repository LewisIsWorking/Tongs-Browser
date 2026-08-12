import { describe, expect, it } from 'vitest';

import {
  buildDiagnosticsReport,
  type DiagnosticsSnapshot,
} from '../../src/debug/DiagnosticsReport.js';

/**
 * What the report says about its OWN observers, which has been wrong about its own numbers three separate times.
 *
 * Each time a line stated something the code had not measured, and each time it sent the
 * investigation somewhere it did not need to go. Now that the builder is pure, those claims can be
 * asserted rather than trusted.
 */
function snapshot(overrides: Partial<DiagnosticsSnapshot> = {}): DiagnosticsSnapshot {
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

const find = (lines: string[], needle: string) => lines.find((line) => line.includes(needle));
describe('buildDiagnosticsReport observer and trace lines', () => {
  /**
   * ⚠️ Silence must be distinguishable from not watching. A device reported "NOTHING observed" while
   * the drag origin was demonstrably being wiped, and those cannot both be true of a WATCHED drag.
   * They are trivially both true of an unwatched one, and nothing said which it was.
   */
  it('says it is not watching when the observers never installed', () => {
    const lines = buildDiagnosticsReport(
      snapshot({ hooksInstalled: { token: false, manager: false } })
    );

    expect(find(lines, "FOUNDRY'S DRAG ENDING")).toContain('NOT WATCHING');
    expect(find(lines, "FOUNDRY'S DRAG ENDING")).not.toContain('NOTHING observed');
  });

  it('says a silent result is real when the observers ARE installed', () => {
    expect(find(buildDiagnosticsReport(snapshot()), "FOUNDRY'S DRAG ENDING")).toContain(
      'observers ARE installed'
    );
  });

  /** A cancel arriving at GRABBED never reaches the token callbacks, only the manager. */
  it('warns that a cancel would be invisible when only the token hook installed', () => {
    const lines = buildDiagnosticsReport(
      snapshot({ hooksInstalled: { token: true, manager: false } })
    );

    expect(find(lines, "FOUNDRY'S DRAG ENDING")).toContain('MANAGER hook never installed');
  });

  it('says none rather than an empty list when no touches arrived', () => {
    expect(find(buildDiagnosticsReport(snapshot({ touchCounts: {} })), 'touch input')).toContain(
      'none'
    );
  });

  it('says none yet when no events have been dispatched', () => {
    expect(buildDiagnosticsReport(snapshot())).toContain('none yet');
  });

  it('renders the dispatch trace as code lines', () => {
    const lines = buildDiagnosticsReport(snapshot({ recentDispatches: ['a', 'b'] }));

    expect(lines.at(-1)).toBe('<code>a</code><br><code>b</code>');
  });
});
