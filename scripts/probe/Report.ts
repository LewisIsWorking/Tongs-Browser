import type { CapabilityRow, TrialOutcome } from './Trials.ts';

/**
 * Saying what the probe found. Extracted from foundry-play-probe 2026-08-12.
 *
 * ⚠️ The whole point of this table is the CONTROL column. A capability that fails through the
 * pointer means nothing on its own: the same gesture may be impossible in that browser at all. Only
 * "the pointer failed every trial AND a native control succeeded in every trial" is a gap that
 * belongs to this module, and that is the line the exit code is set from.
 */

/**
 * ⚠️ Order matters here and it is not cosmetic. 'AIM FAILED' is checked BEFORE 'FLAKY', because a
 * run that never reached its target is not a flaky capability, it is an UNMEASURED one, and calling
 * it flaky would send somebody hunting a race that does not exist.
 */
export function verdict(trials: readonly TrialOutcome[]): string {
  if (trials.every((outcome) => outcome === 'yes')) {
    return 'YES';
  }
  if (trials.some((outcome) => outcome === 'AIM')) {
    return 'AIM FAILED';
  }
  if (trials.some((outcome) => outcome === 'yes')) {
    return 'FLAKY';
  }
  return 'no';
}

/**
 * What the control column says.
 *
 * ⚠️ A null control is "not needed", never "not measured". The control is only run when the pointer
 * path was unreliable, because a control that agrees with a working pointer proves nothing and costs
 * a full set of trials against a live world.
 */
export function describeControl(row: CapabilityRow): string {
  if (row.controlTrials === null) {
    return 'not needed';
  }
  if (row.controlTrials.every((outcome) => outcome === 'yes')) {
    return 'reliable -> OUR GAP';
  }
  if (row.controlTrials.some((outcome) => outcome === 'yes')) {
    return 'flaky -> inconclusive';
  }
  return 'also fails -> inconclusive';
}

/**
 * The capabilities that are OURS to fix.
 *
 * ⚠️ Both halves are required. A pointer that failed every trial is only a gap if a native control
 * succeeded in every trial: without that, the browser may simply not support the gesture, and
 * reporting it as our bug sends somebody to fix code that was never wrong.
 *
 * ⚠️ Every pointer trial must be a real 'no', not merely "not a yes", and that distinction was a
 * defect until 2026-08-12. An 'AIM' means the pointer never REACHED the target, so nothing about the
 * capability was measured. The old test read `!some(yes)`, which counted a run of pure aim failures
 * as a confirmed gap and would have sent somebody to fix a capability that had never been exercised.
 * `verdict` already separates those two, and this now agrees with it.
 *
 * The length check is not redundant: `every` is vacuously true on an empty run, so a capability with
 * no trials at all would otherwise be reported as a proven gap.
 */
export function findGaps(rows: readonly CapabilityRow[]): readonly CapabilityRow[] {
  return rows.filter(
    (row) =>
      row.pointerTrials.length > 0 &&
      row.pointerTrials.every((outcome) => outcome === 'no') &&
      row.controlTrials !== null &&
      row.controlTrials.every((outcome) => outcome === 'yes')
  );
}

/** Print the table and set the exit code from the gaps it found. */
export function reportCapabilities(rows: readonly CapabilityRow[], trials: number): void {
  console.error(
    `\ncapability                                  | via pointer | native control  (${String(trials)} trials each)`
  );
  console.error(
    '--------------------------------------------|-------------|---------------------------'
  );
  for (const row of rows) {
    console.error(
      `${row.name.padEnd(43)} | ${verdict(row.pointerTrials).padEnd(11)} | ${describeControl(row)}`
    );
  }

  const gaps = findGaps(rows);
  console.error(
    `\n${String(gaps.length)} capability gap(s): the pointer failed every trial and a native control succeeded in every trial.`
  );
  process.exitCode = gaps.length > 0 ? 1 : 0;
}
