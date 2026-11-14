import { describe, expect, it } from 'vitest';

import {
  estimateLoading,
  progressText,
  stageShare,
  type StageSeconds,
  timeLeftText,
} from '../../src/ui/loadingEstimate.js';

/**
 * The loading screen's percentage and time left (2026-11-14), worked out from the stage Foundry is on and how
 * long each stage took on this world's past loads. Same curve, cap and wording as the COO portal's world launch.
 */
const HISTORY: StageSeconds = { start: 10, init: 20, setup: 5, textures: 10, draw: 5 }; // 50 s in all

describe('the loading estimate', () => {
  it('gives the share of the whole load, and the time left from this world history', () => {
    // init starts at 10/50 = 20% and is 20/50 = 40% wide; half way through it is 20 + 40 * 0.5 = 40%.
    const view = estimateLoading({ stage: 'init', elapsedSeconds: 10 }, HISTORY);
    expect(view.percent).toBe(40);
    expect(view.secondsLeft).toBe(30); // 10 s more of init, then 5 + 10 + 5
    expect(view.slow).toBe(false);
  });

  it('shows a percentage but no time left on a world it has never timed', () => {
    const view = estimateLoading({ stage: 'init', elapsedSeconds: 10 }, {});
    expect(view.percent).toBeGreaterThan(1);
    expect(view.secondsLeft).toBeNull();
  });

  it('gives no time left while any stage still to come has never been timed', () => {
    const noDraw: StageSeconds = { start: 10, init: 20, setup: 5, textures: 10 };
    expect(estimateLoading({ stage: 'init', elapsedSeconds: 1 }, noDraw).secondsLeft).toBeNull();
    expect(estimateLoading({ stage: 'draw', elapsedSeconds: 1 }, HISTORY).secondsLeft).toBe(4);
  });

  it('never claims done before ready, however long a stage runs', () => {
    const view = estimateLoading({ stage: 'draw', elapsedSeconds: 10_000 }, HISTORY);
    expect(view.percent).toBe(95);
    expect(view.fill).toBeLessThanOrEqual(95);
  });

  it('drops the time left and says so once a stage runs past its usual length', () => {
    const view = estimateLoading({ stage: 'init', elapsedSeconds: 25 }, HISTORY);
    expect(view.slow).toBe(true);
    expect(view.secondsLeft).toBeNull();
    expect(progressText(view)).toBe(`${String(view.percent)}%, taking longer than usual`);
  });

  it('starts at 1%, never 0', () => {
    expect(estimateLoading({ stage: 'start', elapsedSeconds: 0 }, HISTORY).percent).toBe(1);
  });

  it('uses the real share of the map pictures when Foundry reports one', () => {
    // textures starts at 35/50 = 70% and is 10/50 = 20% wide.
    const view = estimateLoading({ stage: 'textures', elapsedSeconds: 0, realShare: 0.5 }, HISTORY);
    expect(view.percent).toBe(80);
    expect(view.secondsLeft).toBe(10); // half of 10 s, then draw's 5
    expect(
      estimateLoading({ stage: 'textures', elapsedSeconds: 30, realShare: 0.5 }, HISTORY).slow
    ).toBe(false);
  });

  it('goes straight up to 85% of a stage, then ever slower, and never past 95%', () => {
    expect(stageShare(0.5)).toBe(0.5);
    expect(stageShare(0.85)).toBe(0.85);
    expect(stageShare(1)).toBeGreaterThan(0.85);
    expect(stageShare(1)).toBeLessThan(0.95);
    expect(stageShare(1000)).toBeLessThanOrEqual(0.95);
  });

  it('glides the bar to the stage 85% mark at the usual pace, then creeps towards its cap', () => {
    expect(estimateLoading({ stage: 'init', elapsedSeconds: 0 }, HISTORY).glide).toEqual({
      fill: 54, // 20 + 40 * 0.85
      seconds: 17, // 85% of 20 s
    });
    const late = estimateLoading({ stage: 'init', elapsedSeconds: 18 }, HISTORY).glide;
    expect(late.fill).toBeCloseTo(58); // 20 + 40 * 0.95
    expect(late.seconds).toBe(60);
  });
});

describe('the loading words, as the portal says them', () => {
  it.each([
    [3, 'a few seconds'],
    [12, 'about 15 seconds'],
    [54, 'about 55 seconds'],
    [55, 'about 1 min'],
    [80, 'about 1 min 20 s'],
    [120, 'about 2 min'],
  ])('%i seconds left reads "%s"', (seconds, words) => {
    expect(timeLeftText(seconds)).toBe(words);
  });

  it('reads "42%, about 1 min left", or the percentage alone without an honest time', () => {
    expect(progressText({ percent: 42, secondsLeft: 60, slow: false })).toBe(
      '42%, about 1 min left'
    );
    expect(progressText({ percent: 42, secondsLeft: null, slow: false })).toBe('42%');
  });
});
