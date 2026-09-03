import { describe, expect, it, vi } from 'vitest';

import { PendingRequests } from '../../src/relay/PendingRequests.js';

/**
 * Requests sent and not yet answered. Written 2026-09-03.
 *
 * ⚠️ Both failures this guards against are silent. An unmatched settle resolves one client's wait on
 * another client's answer, which looks like success. A request nobody answers never ends, which looks
 * like the module hanging rather than like a lost message.
 *
 * COVERS: matching, ignoring ids that are not ours, the timeout, and that settling stops the clock.
 * MISSES: that registration happens before the caller emits. That is a property of how `CreationRelay`
 *   calls this, and `creationRelay.test.ts` exercises it through a socket that delivers synchronously.
 */
function harness(): {
  pending: PendingRequests<string>;
  fire: () => void;
  cleared: () => number;
} {
  /*
   * ⚠️ EVERY timer is kept, not just the latest. A single-slot fake silently made the two-outstanding
   * test unrunnable: the second `wait` overwrote the first's callback, so the first could never time
   * out and the test hung for five seconds before vitest killed it. A fake that models one of a thing
   * cannot test the case where there are two.
   */
  const runs: (() => void)[] = [];
  let cleared = 0;
  const pending = new PendingRequests<string>(
    {
      setTimer: (callback) => {
        runs.push(callback);
        return 'handle';
      },
      clearTimer: () => {
        cleared += 1;
      },
      timeoutMs: 1000,
    },
    () => 'timed out'
  );
  return {
    pending,
    /** Fires every outstanding timer, which is what "nobody answered anything" looks like. */
    fire: () => {
      for (const run of [...runs]) {
        run();
      }
    },
    cleared: () => cleared,
  };
}

describe('matching an answer to an ask', () => {
  it('settles the request it names', async () => {
    const { pending } = harness();
    const waiting = pending.wait('req-1');

    pending.settle('req-1', 'the answer');

    expect(await waiting).toBe('the answer');
  });

  /** ⚠️ Everybody receives every message, so an id we did not send must be ignored, not resolved. */
  it('ignores an id it is not waiting for', async () => {
    const { pending, fire } = harness();
    const waiting = pending.wait('req-mine');

    pending.settle('req-theirs', 'not for me');
    fire();

    expect(await waiting).toBe('timed out');
  });

  it('settles only the matching one when two are outstanding', async () => {
    const { pending, fire } = harness();
    const first = pending.wait('req-1');
    const second = pending.wait('req-2');

    pending.settle('req-2', 'second answer');
    fire();

    expect(await second).toBe('second answer');
    expect(await first).toBe('timed out');
  });
});

describe('stopping', () => {
  /** ⚠️ A settled request must stop being tracked, or a later answer with the same id resolves twice. */
  it('forgets a request once it is settled', () => {
    const { pending } = harness();
    void pending.wait('req-1');
    expect(pending.size()).toBe(1);

    pending.settle('req-1', 'done');

    expect(pending.size()).toBe(0);
  });

  it('cancels the timer when it settles, so nothing fires afterwards', () => {
    const { pending, cleared } = harness();
    void pending.wait('req-1');

    pending.settle('req-1', 'done');

    expect(cleared()).toBe(1);
  });

  it('forgets a request that timed out', async () => {
    const { pending, fire } = harness();
    const waiting = pending.wait('req-1');

    fire();
    await waiting;

    expect(pending.size()).toBe(0);
  });

  /** ⚠️ A late answer after a timeout must do nothing rather than resolve an already-settled promise. */
  it('ignores an answer that arrives after the timeout', async () => {
    const { pending, fire } = harness();
    const waiting = pending.wait('req-1');
    fire();

    expect(await waiting).toBe('timed out');
    expect(() => {
      pending.settle('req-1', 'too late');
    }).not.toThrow();
    expect(pending.size()).toBe(0);
  });
});

describe('the timeout value it is given', () => {
  it('uses the configured delay rather than a hardcoded one', () => {
    const setTimer = vi.fn(() => 'handle');
    const pending = new PendingRequests<string>(
      { setTimer, clearTimer: () => undefined, timeoutMs: 7500 },
      () => 'timed out'
    );

    void pending.wait('req-1');

    expect(setTimer).toHaveBeenCalledWith(expect.any(Function), 7500);
  });
});
