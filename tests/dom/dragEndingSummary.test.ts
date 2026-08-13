import { describe, expect, it } from 'vitest';

import { summariseDragEndings } from '../../src/debug/DragEndingSummary.js';

/**
 * The one line the report prints about how Foundry ended the drag. Split out of foundryDragHooks
 * 2026-08-12, when that file reached 218 lines against a hard 200 limit.
 *
 * ⚠️ Its verdicts are the point, not its formatting. "NOT WATCHING", "nothing observed" and
 * "cancelled" are three different findings, and the first two are the ones a reader is most likely
 * to collapse into "no problem here". A probe whose silence is unfalsifiable is not a probe.
 */
const WATCHING = { token: true, manager: true };
const REDREW = 'token.draw at DRAG, which CANCELLED THE INTERACTION';

describe('summariseDragEndings', () => {
  it('says nothing was observed, and that the observers were installed', () => {
    expect(summariseDragEndings([], WATCHING, 'unmoved')).toContain('observers ARE installed');
  });

  /**
   * ⚠️ Silence and not watching must never read the same. A device reported "NOTHING observed" while
   * the drag origin was demonstrably being wiped, which cannot both be true of a watched drag.
   */
  it('says NOT WATCHING when the observers never installed', () => {
    expect(summariseDragEndings([], { token: false, manager: false }, 'unmoved')).toContain(
      'NOT WATCHING'
    );
  });

  it('warns that a cancel would be invisible without the manager hook', () => {
    expect(summariseDragEndings([], { token: true, manager: false }, 'unmoved')).toContain(
      'MANAGER hook never installed'
    );
  });
});

/**
 * ⚠️ THE REGRESSION THIS FILE EXISTS FOR, reported by a device against build 0.25.52.
 *
 * The report said, forty lines apart and in the same message:
 *
 *   DID IT MOVE: YES (3100,2000 -> 3000,2200)
 *   FOUNDRY'S DRAG ENDING: ... (a REDRAW cancelled the interaction, which is why nothing was written)
 *
 * The redraw branch was tested before the drop branch, so it shadowed everything; and the clause
 * "which is why nothing was written" was a claim about an outcome that was never passed in. A drag
 * that worked was reported as a drag that failed, which is worse than reporting nothing at all.
 */
describe('when the token actually moved', () => {
  it('never blames a redraw for a drag that committed', () => {
    const summary = summariseDragEndings([REDREW], WATCHING, 'moved');

    expect(summary).toContain('the drag committed');
    expect(summary).not.toContain('a REDRAW cancelled');
  });

  it('still lists what was observed, since the mechanism is evidence either way', () => {
    expect(summariseDragEndings([REDREW], WATCHING, 'moved')).toContain(REDREW);
  });

  /** A cancel that nonetheless committed is a real state, and it must not read as a failure. */
  it('outranks a cancel as well as a redraw', () => {
    const summary = summariseDragEndings(
      ['manager.cancel at DRAG [contextmenu button=2 n/a]'],
      WATCHING,
      'moved'
    );

    expect(summary).toContain('the drag committed');
    expect(summary).not.toContain('writes nothing');
  });
});

describe('when the token demonstrably did not move', () => {
  it('blames a redraw that cancelled above HOVER', () => {
    expect(summariseDragEndings([REDREW], WATCHING, 'unmoved')).toContain(
      'a REDRAW cancelled the interaction'
    );
  });

  /**
   * ⚠️ A redraw BELOW hover carries no cancellation marker, so it must not trip the redraw verdict.
   * Before the note read the state, every redraw carried the accusation.
   */
  it('ignores a redraw that did not cancel anything', () => {
    const summary = summariseDragEndings(
      ['token.draw at HOVER, at or below HOVER, so it did not cancel anything'],
      WATCHING,
      'unmoved'
    );

    expect(summary).not.toContain('a REDRAW cancelled');
    expect(summary).toContain('no ending observed');
  });

  it('says a drop means the write itself refused', () => {
    expect(
      summariseDragEndings(['_onDragLeftDrop [pointerup button=0 mouse]'], WATCHING, 'unmoved')
    ).toContain('the write itself refused');
  });

  it('says a cancel writes nothing', () => {
    expect(
      summariseDragEndings(
        ['manager.cancel at DRAG [contextmenu button=2 n/a]'],
        WATCHING,
        'unmoved'
      )
    ).toContain('CANCELLED, which writes nothing');
  });
});

/**
 * ⚠️ The two "cannot say" verdicts must not borrow the language of failure. Neither means the drag
 * failed; both mean the question was never answerable, and saying "nothing was written" there would
 * report a failure nobody measured - the same defect, pointing the other way.
 */
describe('when the outcome could not be judged', () => {
  it('refuses to claim anything about writing when no grab was recorded', () => {
    const summary = summariseDragEndings([REDREW], WATCHING, 'no-grab');

    expect(summary).toContain('UNKNOWN');
    expect(summary).toContain('not about a drag');
    expect(summary).not.toContain('nothing was written');
  });

  it('says the selection was lost rather than blaming the redraw', () => {
    const summary = summariseDragEndings([REDREW], WATCHING, 'no-token');

    expect(summary).toContain('UNKNOWN');
    expect(summary).toContain('nothing to compare');
  });
});
