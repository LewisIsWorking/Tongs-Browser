import { describe, expect, it } from 'vitest';

import { buildApplyPorts } from '../../src/deck/buildApplyPorts.js';

/**
 * The real Foundry behind applying, when part of it is not there. Written 2026-09-13.
 *
 * ⚠️ Split from buildApplyPorts.test.ts to stay under the 200-line limit. Each case is a moment that
 * happens in a real game: the GM has no scene open, or a card's target was recorded in a shape that is
 * not a scene token. None of them may read as damage having landed.
 */
const doc = {
  createElement: () => ({ dataset: {} as Record<string, string> }),
} as unknown as Document;

describe('with nothing of Foundry there', () => {
  it('offers no context entries and finds no token rather than throwing', () => {
    const ports = buildApplyPorts({}, doc);

    expect(ports.contextEntries()).toEqual([]);
    expect(ports.tokenFor('Scene.S1.Token.T1')).toBeNull();
  });
});

describe('watching for damage to land', () => {
  /** ⛔ Without Foundry's hooks nothing could ever confirm it, so it must not wait or claim success. */
  it('resolves false at once when there are no hooks to watch', async () => {
    await expect(buildApplyPorts({}, doc).landed('Scene.S1.Token.T1')).resolves.toBe(false);
  });

  it('resolves false at once, registering nothing, for a target that is not a scene token', async () => {
    const registered: string[] = [];
    const Hooks = {
      on(name: string) {
        registered.push(name);
        return 1;
      },
      off() {
        return undefined;
      },
    };

    await expect(buildApplyPorts({ Hooks }, doc).landed('Actor.A1')).resolves.toBe(false);
    expect(registered).toEqual([]);
  });
});
