import { describe, expect, it, vi } from 'vitest';

import { PENDING_FLAG } from '../../src/automation/AutoApply.js';
import { castCard, harness } from './support/spellSavesWorld.js';

/**
 * Spell saves while no full GM is connected, and when one connects. Written 2026-09-14, split from
 * `spellSaves.test.ts` at the 200 line limit.
 */
describe('queueing and catching up', () => {
  it('does nothing outside the active full GM', async () => {
    const { saves, ports } = harness({ role: () => 'queue' });

    await saves.onMessageCreated(castCard());
    await saves.catchUp();

    expect(ports.rollSave).not.toHaveBeenCalled();
  });

  it('rolls pending casts when a GM connects, and only those', async () => {
    const pending = harness();
    pending.flags.set(`c1.${PENDING_FLAG}`, true);
    await pending.saves.catchUp();
    expect(pending.ports.rollSave).toHaveBeenCalledTimes(1);
    expect(pending.flags.has(`c1.${PENDING_FLAG}`)).toBe(false);

    const quiet = harness();
    await quiet.saves.catchUp();
    expect(quiet.ports.rollSave).not.toHaveBeenCalled();
  });

  it('never works on one card twice at once', async () => {
    let release: () => void = () => undefined;
    const rollSave = vi.fn(
      () =>
        new Promise<{ kind: 'rolled' }>((resolve) => {
          release = () => {
            resolve({ kind: 'rolled' });
          };
        })
    );
    const { saves } = harness({ rollSave });

    const first = saves.onMessageCreated(castCard());
    await new Promise((resolve) => setTimeout(resolve, 0));
    await saves.onMessageCreated(castCard());
    release();
    await first;

    expect(rollSave).toHaveBeenCalledTimes(1);
  });
});
