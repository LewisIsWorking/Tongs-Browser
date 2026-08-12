import { describe, expect, it } from 'vitest';

import {
  buildDiagnosticsReport,
  describeThinly,
  toPlainText,
  type DiagnosticsSnapshot,
} from '../../src/debug/DiagnosticsReport.js';

/**
 * The diagnostics report, which has been wrong about its own numbers three separate times.
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
    dragEndings: [],
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

describe('describeThinly', () => {
  /**
   * ⚠️ The single most costly line in this report's history. A confidently printed `0.0px` was read
   * as "the pointer never moved" three times over. It must refuse rather than invent a zero.
   */
  it('refuses outright when nothing was ever sampled', () => {
    expect(describeThinly({ sampled: false, peak: 0, samples: 0 }, 200)).toContain(
      'NOT MEASURABLE'
    );
    expect(describeThinly({ sampled: false, peak: 0, samples: 0 }, 200)).toContain(
      'not a distance of zero'
    );
  });

  it('states a reading plainly when the sampling covers the gesture', () => {
    expect(describeThinly({ sampled: true, peak: 120.4, samples: 180 }, 200)).toBe(
      '120.4px over 180 samples'
    );
  });

  /** 2 samples of 235 moves is not a small measurement, it is a measurement of something else. */
  it('disowns a reading sampled for almost none of the gesture', () => {
    const text = describeThinly({ sampled: true, peak: 0, samples: 2 }, 235);

    expect(text).toContain('0.0px over 2 samples of 235 moves');
    expect(text).toContain('WIPED mid drag');
  });

  /**
   * ⚠️ And it must say WIPED rather than "transient", which is what this claimed for three releases.
   * `interactionData` is a plain property that persists until `reset()`, so thin sampling is a
   * finding about Foundry rather than a measurement error to be shrugged off.
   */
  it('does not repeat the wrong explanation that the data is transient', () => {
    expect(describeThinly({ sampled: true, peak: 0, samples: 2 }, 235)).not.toContain('transient');
  });

  it('trusts a reading when there is no move count to judge it against', () => {
    expect(describeThinly({ sampled: true, peak: 5, samples: 1 }, 0)).toBe('5.0px over 1 samples');
  });
});

describe('buildDiagnosticsReport', () => {
  /**
   * The ORDER is load bearing. A phone chat window shows roughly fifteen lines and silently
   * truncates, and an earlier report was cut off exactly at the field the round existed to read.
   */
  it('leads with the build and the answer, before any explanation', () => {
    const lines = buildDiagnosticsReport(snapshot());

    expect(lines[0]).toContain('BUILD 0.24.3');
    expect(lines[1]).toContain('DID IT MOVE');
    expect(lines.slice(0, 6).join(' ')).toContain('GRABBED ON THE TOKEN');
  });

  it('tells the user to move further when the pointer travelled under the threshold', () => {
    const lines = buildDiagnosticsReport(snapshot({ pointerTravel: { recorded: true, peak: 4 } }));

    expect(find(lines, 'OUR pointer travelled')).toContain('under');
    expect(find(lines, 'OUR pointer travelled')).toContain('move further');
  });

  it('says the gate should have opened when it travelled far enough', () => {
    expect(find(buildDiagnosticsReport(snapshot()), 'OUR pointer travelled')).toContain(
      'gate below should have opened'
    );
  });

  it('says no grab was recorded rather than printing a distance of zero', () => {
    const lines = buildDiagnosticsReport(snapshot({ pointerTravel: { recorded: false, peak: 0 } }));

    expect(find(lines, 'OUR pointer travelled')).toContain('no grab recorded');
  });

  /** A resize redraws the canvas, and redrawing a token cancels its interaction. */
  it('calls out viewport resizes during the drag, and stays quiet when there were none', () => {
    const withResizes = buildDiagnosticsReport(
      snapshot({ viewport: { atGrab: '360x607', now: '360x520', resizes: 3 } })
    );
    expect(find(withResizes, 'viewport:')).toContain('CANCELS its interaction');

    expect(find(buildDiagnosticsReport(snapshot()), 'viewport:')).not.toContain('CANCELS');
  });

  /** Zero moves to the token means Foundry never evaluated its gate at all. */
  it('flags zero moves to the token, and stays quiet otherwise', () => {
    const none = buildDiagnosticsReport(snapshot({ moves: { token: 0, layer: 90, stage: 400 } }));
    expect(find(none, 'PIXI moves TO THE TOKEN')).toContain('ZERO');

    expect(find(buildDiagnosticsReport(snapshot()), 'PIXI moves TO THE TOKEN')).not.toContain(
      'ZERO'
    );
  });

  /**
   * The threshold suffix only makes sense beside a real reading. Printing "needs >= 10" next to a
   * refusal is exactly the shape of claim that misdirected this investigation three times.
   */
  it('omits the threshold when the gate was never sampled, and includes it when it was', () => {
    const unmeasured = buildDiagnosticsReport(
      snapshot({ dragGate: { sampled: false, peak: 0, samples: 0 } })
    );
    expect(find(unmeasured, 'DRAG GATE')).not.toContain('needs >= 10');

    expect(find(buildDiagnosticsReport(snapshot()), 'DRAG GATE')).toContain('needs >= 10');
  });

  it('says not measurable when the divergence was never sampled', () => {
    const lines = buildDiagnosticsReport(
      snapshot({ divergence: { sampled: false, peak: 0, samples: 0 } })
    );

    expect(find(lines, 'ours vs PIXI during the drag')).toContain('not measurable');
  });

  it('warns when PIXI is not tracking our pointer, since it invalidates the rest', () => {
    const lines = buildDiagnosticsReport(
      snapshot({ divergence: { sampled: true, peak: 250, samples: 400 } })
    );

    expect(find(lines, 'ours vs PIXI during the drag')).toContain('NOT TRACKING OUR POINTER');
  });

  it('names the interaction state rather than printing a bare number', () => {
    expect(find(buildDiagnosticsReport(snapshot()), 'PEAK state')).toContain('DRAG (4)');
    expect(
      find(buildDiagnosticsReport(snapshot({ peakInteractionState: 99 })), 'PEAK state')
    ).toContain('UNKNOWN (99)');
  });

  it('prompts to release the grab when no drop was seen', () => {
    const lines = buildDiagnosticsReport(snapshot({ releasedDuringDrag: false }));

    expect(find(lines, 'released during drag')).toContain('tap the hand OFF');
  });

  it('says no grab was recorded when nothing has been grabbed yet', () => {
    const lines = buildDiagnosticsReport(snapshot({ grabbedOnToken: null }));

    expect(find(lines, 'GRABBED ON THE TOKEN')).toContain('no grab recorded yet');
  });

  it('reports NaN for a gate distance that was never computed', () => {
    const lines = buildDiagnosticsReport(snapshot({ lastGateDistance: Number.NaN }));

    expect(find(lines, 'last gate distance')).toContain('origin or pointer missing');
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

describe('toPlainText', () => {
  /**
   * The clipboard copy exists because reading a report off a phone screenshot truncates it, so the
   * plain form has to keep every line break the markup was providing.
   */
  it('turns line break markup into real newlines and drops the rest', () => {
    expect(toPlainText(['<strong>a</strong>', '<code>b</code><br><code>c</code>'])).toBe('a\nb\nc');
  });
});
