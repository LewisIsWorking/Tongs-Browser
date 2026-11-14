import {
  estimateLoading,
  LOADING_ORDER,
  type LoadingStage,
  type LoadingView,
  type StageSeconds,
} from './loadingEstimate.js';
import type { LoadingHistory } from './loadingHistory.js';

/**
 * ⏱️ Times this load's stages as Foundry's hooks move it on, says how far it has got, and at `ready` remembers how
 * long each stage took for next time. Added 2026-11-14.
 *
 * Only a stage that ran from its own start to the very next stage's is recorded. A load that skips one (no
 * canvas, so the map stages never start) records nothing for what it skipped rather than lumping two stages
 * together under one name, which would make the next load's estimate wrong.
 */
export class LoadingProgress {
  private stage: LoadingStage = 'start';
  private stageAt: number;
  private readonly took: StageSeconds = {};
  private worldId: string | null = null;
  private typical: StageSeconds;
  private finished = false;

  public constructor(
    private readonly history: LoadingHistory,
    private readonly now: () => number = Date.now
  ) {
    this.stageAt = now();
    this.typical = history.typical();
  }

  public get current(): LoadingStage {
    return this.stage;
  }

  public get done(): boolean {
    return this.finished;
  }

  /** The world is known (from `init`): measure against its own history from now on. */
  public world(id: string | undefined): void {
    if (!id || this.worldId !== null) return;
    this.worldId = id;
    this.typical = this.history.typical(id);
  }

  /** Moves on to `next`. Never backwards, and ignored once the load is over. */
  public enter(next: LoadingStage): void {
    if (this.finished) return;
    const from = LOADING_ORDER.indexOf(this.stage);
    const to = LOADING_ORDER.indexOf(next);
    if (to <= from) return;
    const at = this.now();
    if (to === from + 1) this.took[this.stage] = (at - this.stageAt) / 1000;
    this.stage = next;
    this.stageAt = at;
  }

  /** How far the load has got now; `realShare` is the current stage's own progress when Foundry gives one. */
  public view(realShare: number | null = null): LoadingView {
    const elapsedSeconds = (this.now() - this.stageAt) / 1000;
    return estimateLoading({ stage: this.stage, elapsedSeconds, realShare }, this.typical);
  }

  /** `ready`: the last stage ends, and the stages this load ran in full are remembered for this world. */
  public finish(): void {
    if (this.finished) return;
    this.finished = true;
    // Only the last stage ends at `ready`; any other stage still running here was cut short by a skip.
    if (this.stage === 'draw') this.took.draw = (this.now() - this.stageAt) / 1000;
    if (this.worldId !== null) this.history.record(this.worldId, this.took);
  }

  /** Gave up waiting: nothing is recorded, since this load never finished. */
  public abandon(): void {
    this.finished = true;
  }
}
