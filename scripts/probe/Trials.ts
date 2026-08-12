/**
 * What a capability trial is, and what it concludes. Extracted from foundry-play-probe 2026-08-12.
 */
/**
 * What one trial concluded.
 *
 * ⚠️ 'AIM' is a third outcome and NOT a failure, which is the distinction the whole probe rests
 * on. It means the pointer never reached the target, so the trial says nothing at all about the
 * capability: folding it into 'no' would report "this feature is broken" for what is actually
 * "the test could not be performed", and those lead to completely different work.
 */
export type TrialOutcome = 'yes' | 'no' | 'AIM';

/** Where a synthetic event is aimed, in client coordinates. */
export interface ClientAt {
  clientX: number;
  clientY: number;
}

/**
 * One capability, measured both ways.
 *
 * `controlTrials` is null when the pointer path was reliable, because a control is only worth
 * running to explain a failure. A null therefore reads as "not needed", never as "not measured".
 */
export interface CapabilityRow {
  name: string;
  pointerTrials: TrialOutcome[];
  controlTrials: TrialOutcome[] | null;
  note?: string;
}

/**
 * What a trial's path and read callbacks are handed.
 *
 * The Foundry objects here are deliberately `any`, matching `foundry-globals.d.ts`: they are
 * somebody else's documents and a partial description of them would drift. `at` is OURS though,
 * computed by `aim` from the canvas transform, so it gets a real type.
 */
export interface TrialContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  token?: any;
  at?: ClientAt;
}

export type TrialPath = (context: TrialContext) => Promise<unknown>;
export type TrialRead = (context: TrialContext) => Promise<unknown>;
