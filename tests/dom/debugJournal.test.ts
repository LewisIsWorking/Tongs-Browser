import { describe, expect, it } from 'vitest';

import { DebugJournal, JOURNAL_LIMIT, formatJournal } from '../../src/debug/DebugJournal.js';

/**
 * The rolling timeline the report prints.
 *
 * ⚠️ The requirement behind every test here came from a user, not from the report: "dragging works
 * with the hand off, and breaks with it on". Four rounds of snapshot diagnostics never surfaced
 * that, because a snapshot cannot record a BUTTON PRESS.
 */
let clock = 0;
const make = (limit?: number) =>
  new DebugJournal({ now: () => clock, ...(limit === undefined ? {} : { limit }) });

const advance = (ms: number) => {
  clock += ms;
};

describe('recording a timeline', () => {
  it('keeps entries in the order they happened', () => {
    clock = 0;
    const journal = make();

    journal.record('ui', 'grab pressed');
    advance(5);
    journal.record('dispatch', 'pointerdown');
    advance(3);
    journal.record('foundry', 'manager.cancel at GRABBED');

    expect(journal.getEntries().map((entry) => entry.detail)).toEqual([
      'grab pressed',
      'pointerdown',
      'manager.cancel at GRABBED',
    ]);
  });

  /** The gap is the diagnosis: 2ms is a dispatch bug, 500ms is Foundry's long press timeout. */
  it('records when each thing happened, relative to the first', () => {
    clock = 1000;
    const journal = make();

    journal.record('ui', 'grab pressed');
    advance(500);
    journal.record('foundry', 'manager.cancel');

    expect(journal.getEntries().map((entry) => entry.at)).toEqual([0, 500]);
  });
});

describe('keeping the buffer readable', () => {
  /**
   * ⚠️ Without collapsing, one drag's pointermoves fill the whole buffer and evict the tap that
   * caused them, so the single entry the journal exists to preserve is the first one discarded.
   */
  it('collapses a repeated entry into a count instead of repeating it', () => {
    clock = 0;
    const journal = make();

    journal.record('ui', 'grab pressed');
    for (let index = 0; index < 200; index += 1) {
      advance(1);
      journal.record('dispatch', 'pointermove');
    }

    const entries = journal.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.detail).toBe('grab pressed');
    expect(entries[1]?.detail).toBe('pointermove ×200');
  });

  it('keeps the time of the FIRST of a run, not the last', () => {
    clock = 0;
    const journal = make();
    journal.record('dispatch', 'pointermove');
    advance(50);
    journal.record('dispatch', 'pointermove');

    expect(journal.getEntries()[0]?.at).toBe(0);
  });

  it('does not collapse the same detail from a different source', () => {
    clock = 0;
    const journal = make();

    journal.record('dispatch', 'pointerup');
    journal.record('foundry', 'pointerup');

    expect(journal.getEntries()).toHaveLength(2);
  });

  it('drops the OLDEST once full, because the end of a gesture is what is being diagnosed', () => {
    clock = 0;
    const journal = make(3);

    for (const detail of ['a', 'b', 'c', 'd']) {
      journal.record('ui', detail);
    }

    expect(journal.getEntries().map((entry) => entry.detail)).toEqual(['b', 'c', 'd']);
  });

  it('bounds itself by default, so a long session cannot grow without limit', () => {
    clock = 0;
    const journal = make();

    for (let index = 0; index < JOURNAL_LIMIT + 20; index += 1) {
      journal.record('ui', `entry ${String(index)}`);
    }

    expect(journal.getEntries()).toHaveLength(JOURNAL_LIMIT);
  });

  it('can be emptied, so one report does not carry the previous one’s history', () => {
    clock = 0;
    const journal = make();
    journal.record('ui', 'old');

    journal.clear();

    expect(journal.getEntries()).toEqual([]);
  });

  /** The returned array is a copy: a caller that sorts it must not reorder the journal itself. */
  it('hands out a copy rather than its own array', () => {
    clock = 0;
    const journal = make();
    journal.record('ui', 'kept');

    (journal.getEntries() as JournalEntryArray).length = 0;

    expect(journal.getEntries()).toHaveLength(1);
  });
});

interface JournalEntryArray {
  length: number;
}

describe('formatting the timeline', () => {
  it('prints the gap before each entry rather than an absolute time', () => {
    clock = 0;
    const journal = make();
    journal.record('ui', 'grab pressed');
    advance(7);
    journal.record('foundry', 'manager.cancel');

    expect(formatJournal(journal.getEntries())).toBe(
      '+0ms [ui] grab pressed\n+7ms [foundry] manager.cancel'
    );
  });

  /**
   * ⚠️ Silence must be falsifiable. "Nothing recorded" and "never wired up" are different bugs and
   * an empty timeline alone cannot tell them apart, so the line says both possibilities out loud.
   */
  it('says plainly that an empty timeline is ambiguous', () => {
    expect(formatJournal([])).toContain('never wired up');
  });
});
