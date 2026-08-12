import { formatJournal, type JournalEntry } from './DebugJournal.js';

/**
 * The timeline section of the report. Added 2026-08-12.
 *
 * Its own file because `DiagnosticsReport` was at 187 lines against a hard 200 limit, and because
 * the timeline is the one part of the report with a rendering decision in it rather than a value to
 * interpolate.
 */

/**
 * ⚠️ The last entries, not the first, and the two are not interchangeable. The journal already keeps
 * the most recent sixty; this trims further for the chat card, and what is being diagnosed is always
 * how a gesture ENDED. Showing the head would reliably cut off the cancel.
 */
export const TIMELINE_SHOWN = 24;

export function buildJournalSection(entries: readonly JournalEntry[]): string[] {
  const shown = entries.slice(-TIMELINE_SHOWN);
  const dropped = entries.length - shown.length;

  /*
   * ⚠️ The number dropped is PRINTED, never silently truncated. A timeline that starts mid gesture
   * and does not say so reads as a complete account of the gesture, and the reader then concludes
   * the button press never happened rather than that it scrolled off.
   */
  const heading =
    dropped > 0
      ? `<strong>TIMELINE (last ${String(shown.length)}, ${String(dropped)} earlier entries dropped):</strong>`
      : `<strong>TIMELINE (${String(shown.length)} entries):</strong>`;

  return [
    heading,
    `<pre style="font-size:0.85em;white-space:pre-wrap">${formatJournal(shown)}</pre>`,
  ];
}
