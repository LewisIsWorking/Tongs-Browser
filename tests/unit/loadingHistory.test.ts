import { describe, expect, it } from 'vitest';

import {
  LOADING_HISTORY_KEY,
  LOADING_SAMPLES,
  LoadingHistory,
  type LoadingStore,
  median,
} from '../../src/ui/loadingHistory.js';

/**
 * How long each loading stage took on this browser's recent loads of each world (2026-11-14). Storage that is
 * missing, broken or refusing must never stop Foundry opening: it only costs the time left.
 */
class MemoryStore implements LoadingStore {
  public readonly items = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const history = (store: LoadingStore | null, now = (): number => 0): LoadingHistory =>
  new LoadingHistory(() => store, now);

describe('the loading history', () => {
  it('knows nothing about a world it has never opened', () => {
    expect(history(new MemoryStore()).typical('w')).toEqual({});
  });

  it('remembers each stage of a finished load, for that world only', () => {
    const store = new MemoryStore();
    history(store).record('w', { start: 4, init: 30 });
    expect(history(store).typical('w')).toEqual({ start: 4, init: 30 });
    expect(history(store).typical('other')).toEqual({});
  });

  it('measures a load whose world is not known yet against the world opened last', () => {
    const store = new MemoryStore();
    history(store).record('a', { start: 4 });
    history(store).record('b', { start: 9 });
    expect(history(store).typical()).toEqual({ start: 9 });
  });

  it('takes the median of the newest few loads, so one slow load moves it little', () => {
    const store = new MemoryStore();
    for (const init of [900, 800, 10, 11, 700, 12, 13]) history(store).record('w', { init });
    expect(LOADING_SAMPLES).toBe(5);
    expect(history(store).typical('w').init).toBe(12); // newest five: 10, 11, 700, 12, 13
  });

  it('forgets the world opened longest ago once it remembers eight', () => {
    const store = new MemoryStore();
    for (let i = 0; i < 9; i++) history(store, () => i).record(`w${String(i)}`, { init: i + 1 });
    expect(history(store).typical('w0')).toEqual({});
    expect(history(store).typical('w1')).toEqual({ init: 2 });
    expect(history(store).typical('w8')).toEqual({ init: 9 });
  });

  it('ignores what is not a duration, stored or given', () => {
    const store = new MemoryStore();
    store.setItem(
      LOADING_HISTORY_KEY,
      JSON.stringify({
        last: 'w',
        worlds: {
          w: { at: 1, stages: { init: [-1, 'x', null, 6] } },
          bad: 3,
          v: { stages: { init: 'x' } },
        },
      })
    );
    history(store).record('w', { start: Number.NaN, init: 8 });
    expect(history(store).typical('w')).toEqual({ init: 7 });
    expect(history(store).typical('v')).toEqual({});
  });

  it('starts again from nothing when what is stored is not its own', () => {
    for (const raw of ['not json', '42', 'null', '{"worlds":7}']) {
      const store = new MemoryStore();
      store.setItem(LOADING_HISTORY_KEY, raw);
      expect(history(store).typical()).toEqual({});
      history(store).record('w', { init: 3 });
      expect(history(store).typical('w')).toEqual({ init: 3 });
    }
  });

  it('carries on without storage, or with storage that refuses every call', () => {
    const refusing: LoadingStore = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    for (const store of [null, refusing]) {
      expect(() => {
        history(store).record('w', { init: 3 });
      }).not.toThrow();
      expect(history(store).typical('w')).toEqual({});
    }
  });
});

describe('median', () => {
  it('is the middle value, or the mean of the middle two, and null for none', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
