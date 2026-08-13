import { describe, expect, it } from 'vitest';

import { buildDiagnosticsReport } from '../../src/debug/DiagnosticsReport.js';
import { find, snapshot } from './support/diagnosticsSnapshot.js';

/**
 * What the report says about its OWN observers, which has been wrong about its own numbers three
 * separate times.
 *
 * Each time a line stated something the code had not measured, and each time it sent the
 * investigation somewhere it did not need to go. Now that the builder is pure, those claims can be
 * asserted rather than trusted.
 */
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
