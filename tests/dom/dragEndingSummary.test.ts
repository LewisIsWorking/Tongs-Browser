import { describe, expect, it } from 'vitest';

import { summariseDragEndings } from '../../src/debug/FoundryDragHooks.js';

/**
 * The one line the report prints about how Foundry ended the drag. Split out of foundryDragHooks
 * 2026-08-12, when that file reached 218 lines against a hard 200 limit.
 *
 * ⚠️ Its verdicts are the point, not its formatting. "NOT WATCHING", "nothing observed" and
 * "cancelled" are three different findings, and the first two are the ones a reader is most likely
 * to collapse into "no problem here". A probe whose silence is unfalsifiable is not a probe.
 */
describe('summariseDragEndings', () => {
  it('says nothing was observed, and that the observers were installed', () => {
    expect(summariseDragEndings([])).toContain('observers ARE installed');
  });

  /**
   * ⚠️ Silence and not watching must never read the same. A device reported "NOTHING observed" while
   * the drag origin was demonstrably being wiped, which cannot both be true of a watched drag.
   */
  it('says NOT WATCHING when the observers never installed', () => {
    expect(summariseDragEndings([], { token: false, manager: false })).toContain('NOT WATCHING');
  });

  it('warns that a cancel would be invisible without the manager hook', () => {
    expect(summariseDragEndings([], { token: true, manager: false })).toContain(
      'MANAGER hook never installed'
    );
  });

  /** A redraw explains everything else, so it wins over the other verdicts. */
  it('blames a redraw above all else', () => {
    const summary = summariseDragEndings([
      'token.draw DURING THE DRAG (this cancels the interaction)',
      'manager.cancel at GRABBED [no event, Foundry did it itself]',
    ]);

    expect(summary).toContain('a REDRAW cancelled the interaction');
  });

  it('says a drop means the write itself refused', () => {
    expect(summariseDragEndings(['_onDragLeftDrop [pointerup button=0 mouse]'])).toContain(
      'the write itself refused'
    );
  });

  it('says a cancel writes nothing', () => {
    expect(summariseDragEndings(['manager.cancel at DRAG [contextmenu button=2 n/a]'])).toContain(
      'CANCELLED, which writes nothing'
    );
  });

  it('just lists observations it has no verdict for', () => {
    expect(summariseDragEndings(['_onDragLeftStart [pointermove button=0 n/a]'])).toBe(
      '_onDragLeftStart [pointermove button=0 n/a]'
    );
  });
});
