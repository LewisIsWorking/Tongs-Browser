/**
 * A rolling record of what actually happened, in order. Added 2026-08-12.
 *
 * ⚠️ Every other diagnostic here is a SNAPSHOT, and four device round trips went into learning why
 * that is not enough. The report could say the token did not move, that a cancel fired at GRABBED,
 * and what the interaction state was afterwards, and still not say the one thing that turned out to
 * matter: that the user had tapped the grab button rather than dragged with a finger. "Dragging
 * works with the hand off, and breaks with it on" was discovered by the user, not by the report,
 * and no amount of end state detail was ever going to produce it.
 *
 * So this records CAUSES as well as effects: button presses, setting changes, gestures, synthetic
 * dispatches and Foundry's own callbacks, interleaved on one timeline with the timing between them.
 * A cancel two milliseconds after a tap and a cancel five hundred milliseconds after one are a
 * dispatch bug and a long press timeout respectively, and they are indistinguishable without this.
 */

/** Where an entry came from, so a timeline can be read at a glance. */
export type JournalSource =
  /** A control the user touched: a tray button, the collapse handle, a setting. */
  | 'ui'
  /** A raw gesture the touch layer recognised. */
  | 'gesture'
  /** An event this module synthesised and dispatched. */
  | 'dispatch'
  /** Something Foundry did, observed through a hook. */
  | 'foundry';

export interface JournalEntry {
  /** Milliseconds since the journal was created, so the gaps are readable without arithmetic. */
  readonly at: number;
  readonly source: JournalSource;
  readonly detail: string;
}

/**
 * ⚠️ Bounded, and small enough to paste into a chat message. A drag emits hundreds of moves, and an
 * unbounded journal would both leak and bury the six lines that matter under four hundred that do
 * not. The OLDEST are dropped: the end of a gesture is what is being diagnosed.
 */
export const JOURNAL_LIMIT = 60;

export interface DebugJournalOptions {
  /** Injected so tests can advance time without waiting for it. */
  readonly now: () => number;
  readonly limit?: number;
}

export class DebugJournal {
  private readonly entries: JournalEntry[] = [];
  private readonly startedAt: number;
  private readonly limit: number;

  public constructor(private readonly options: DebugJournalOptions) {
    this.startedAt = options.now();
    this.limit = options.limit ?? JOURNAL_LIMIT;
  }

  public record(source: JournalSource, detail: string): void {
    /*
     * ⚠️ Consecutive identical entries are COUNTED rather than repeated, which is what makes a
     * pointermove stream readable at all. Without it a single drag fills the whole buffer with the
     * same line and evicts the tap that caused it, so the one entry the journal exists to preserve
     * is the first one thrown away.
     */
    const last = this.entries.at(-1);
    if (last?.source === source && stripCount(last.detail) === detail) {
      this.entries[this.entries.length - 1] = {
        at: last.at,
        source,
        detail: `${detail} ×${String(countOf(last.detail) + 1)}`,
      };
      return;
    }

    this.entries.push({ at: this.options.now() - this.startedAt, source, detail });
    if (this.entries.length > this.limit) {
      this.entries.shift();
    }
  }

  public getEntries(): readonly JournalEntry[] {
    return [...this.entries];
  }

  public clear(): void {
    this.entries.length = 0;
  }
}

/** The detail without the `×n` suffix this class appends, so a repeat is recognised as one. */
function stripCount(detail: string): string {
  return detail.replace(/ ×\d+$/, '');
}

function countOf(detail: string): number {
  const match = / ×(\d+)$/.exec(detail);
  return match?.[1] === undefined ? 1 : Number(match[1]);
}

/** The timeline as the report prints it: newest last, with the gap before each entry. */
export function formatJournal(entries: readonly JournalEntry[]): string {
  if (entries.length === 0) {
    return 'nothing recorded, so either nothing happened or the journal was never wired up.';
  }
  return entries
    .map((entry, index) => {
      const previous = entries[index - 1];
      const gap = previous === undefined ? 0 : entry.at - previous.at;
      return `+${String(Math.round(gap))}ms [${entry.source}] ${entry.detail}`;
    })
    .join('\n');
}
