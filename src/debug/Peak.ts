import type { SampledPeak } from './DiagnosticsReport.js';

/**
 * How many times each peak was actually sampled, reported beside it. Added 2026-08-11.
 *
 * ⚠️ A peak is not a measurement over a gesture, it is a measurement over however many samples it
 * happened to get, and those are only the same thing when the sampling covers the gesture. This
 * has now been the same mistake three times in one investigation: a bare `0.0` that had sampled
 * nothing at all, then a `0.0` peak that may have sampled only the first move, when the pointer was
 * still on top of its own origin and a distance of zero was the correct answer to a question
 * nobody wanted asked.
 *
 * Both readings look exactly like "the pointer never moved", and one of them was used to conclude
 * that Foundry's drag origin follows the pointer, which is a strong claim to build on a number
 * that might have one sample behind it.
 *
 * The count makes the difference visible without anyone having to suspect it: `0.0px over 47
 * samples` is evidence, `0.0px over 1 sample` is noise wearing the same clothes.
 */
/** A peak that also remembers how often it was looked at. */
export class Peak {
  private value = 0;
  private count = 0;

  public add(reading: number): void {
    this.count += 1;
    if (Number.isFinite(reading) && reading > this.value) {
      this.value = reading;
    }
  }

  public reset(): void {
    this.value = 0;
    this.count = 0;
  }

  public read(): SampledPeak {
    return { sampled: this.count > 0, peak: this.value, samples: this.count };
  }
}
