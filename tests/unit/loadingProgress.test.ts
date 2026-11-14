import { describe, expect, it } from 'vitest';

import { LoadingHistory, type LoadingStore } from '../../src/ui/loadingHistory.js';
import { LoadingProgress } from '../../src/ui/LoadingProgress.js';

/**
 * Timing one load's stages and remembering them at `ready` (2026-11-14). Only a stage that ran from its own start
 * to the very next one's is recorded, so a skipped stage never lumps two under one name.
 */
function harness(): {
  progress: LoadingProgress;
  history: LoadingHistory;
  wait(seconds: number): void;
} {
  const items = new Map<string, string>();
  const store: LoadingStore = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
  };
  let now = 0;
  const history = new LoadingHistory(() => store);
  return {
    progress: new LoadingProgress(history, () => now),
    history,
    wait: (seconds) => {
      now += seconds * 1000;
    },
  };
}

describe('timing a load', () => {
  it('remembers how long every stage took once the world is ready', () => {
    const { progress, history, wait } = harness();
    wait(4);
    progress.world('w');
    progress.enter('init');
    wait(30);
    progress.enter('setup');
    wait(2);
    progress.enter('textures');
    wait(8);
    progress.enter('draw');
    wait(3);
    progress.finish();
    expect(history.typical('w')).toEqual({ start: 4, init: 30, setup: 2, textures: 8, draw: 3 });
  });

  it('records nothing for a stage it skipped, nor for the one running when it skipped', () => {
    const { progress, history, wait } = harness();
    progress.world('w');
    wait(1);
    progress.enter('init');
    wait(5);
    progress.enter('setup');
    wait(7); // no canvas: the map stages never start
    progress.finish();
    expect(history.typical('w')).toEqual({ start: 1, init: 5 });
  });

  it('never goes backwards, and ignores hooks once the load is over', () => {
    const { progress, wait } = harness();
    progress.enter('setup');
    progress.enter('init');
    expect(progress.current).toBe('setup');
    progress.finish();
    wait(1);
    progress.enter('draw');
    expect(progress.current).toBe('setup');
    expect(progress.done).toBe(true);
  });

  it('remembers nothing when it never learnt the world, or gave up waiting', () => {
    const unknown = harness();
    unknown.progress.enter('init');
    unknown.progress.finish();
    expect(unknown.history.typical()).toEqual({});

    const abandoned = harness();
    abandoned.progress.world('w');
    abandoned.progress.enter('init');
    abandoned.progress.abandon();
    abandoned.progress.finish();
    expect(abandoned.history.typical('w')).toEqual({});
  });

  it('measures against this world from init on, not the world opened last', () => {
    const { progress, history, wait } = harness();
    history.record('last', { start: 100, init: 100, setup: 100, textures: 100, draw: 100 });
    history.record('w', { start: 10, init: 20, setup: 5, textures: 10, draw: 5 });
    history.record('last', {});
    progress.world('w');
    progress.world('ignored');
    progress.enter('init');
    wait(10);
    expect(progress.view().percent).toBe(40);
  });
});
