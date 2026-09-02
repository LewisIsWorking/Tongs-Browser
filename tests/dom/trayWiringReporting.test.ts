import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GAMEMASTER,
  clearWorld,
  findTrayAction as find,
  globals,
  partyWorld,
} from './support/trayWiringWorld.js';

/**
 * How a failure reaches the user. Written 2026-09-02, split from `trayWiring.test.ts` at the 200 line
 * limit.
 *
 * ⚠️ Every test here works by NOT stubbing `Actor`, so the create genuinely throws and its reason has
 * to travel somewhere real. That is deliberate: a fabricated error would prove the reporting call
 * exists, and what needs proving is that a reason produced deep in `CreateSheetDeps` still has words
 * in it by the time it reaches a banner.
 */
beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(clearWorld);

describe('when the create fails', () => {
  /**
   * ⚠️ BOTH the banner and the console, not either. A phone user has no devtools, so a message only
   * in the console is a message nobody reads. A banner alone loses the text the moment it fades, and
   * the reason is exactly the part somebody needs to quote when asking for help.
   */
  it('puts the reason in front of the user, not only in the console', async () => {
    const info = vi.fn();
    partyWorld([GAMEMASTER]);
    globals['ui'] = { notifications: { info } };

    find('create-sheet')?.activate();

    await vi.waitFor(() => {
      expect(info).toHaveBeenCalled();
    });
    expect(String(info.mock.calls[0]?.[0])).toContain('Actor.create');
  });

  /** ⚠️ The banner and the console fail independently, so losing one must not lose the message. */
  it('still says something when Foundry has no notification banner', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    partyWorld([GAMEMASTER]);

    find('create-sheet')?.activate();

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalled();
    });
    warn.mockRestore();
  });

  /**
   * ⚠️ The reason survives the whole chain. `CreateSheetDeps` throws, `createSheetInParty` turns it
   * into an outcome, the flow prefixes it, and the wiring hands it to the banner. A break anywhere
   * along that leaves the user with a message that says something went wrong and not what.
   */
  it('keeps the specific reason, not just a generic failure', async () => {
    const info = vi.fn();
    partyWorld([GAMEMASTER]);
    globals['ui'] = { notifications: { info } };

    find('create-sheet')?.activate();

    await vi.waitFor(() => {
      expect(info).toHaveBeenCalled();
    });
    const message = String(info.mock.calls[0]?.[0]);
    expect(message).toContain('could not be created');
    expect(message).toContain('Actor.create');
  });
});
