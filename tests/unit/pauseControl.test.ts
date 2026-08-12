import { describe, expect, it, vi } from 'vitest';

import {
  applyPause,
  decidePauseAction,
  isDesignatedGm,
  type FoundryGame,
} from '../../src/foundry/PauseControl.js';

/**
 * Pausing the world from a phone.
 *
 * ⚠️ The hard part is not the toggle, it is WHO may broadcast it. Foundry's `Game#togglePause` only
 * emits the socket message `if ( options.broadcast && game.user.isGM )`, so a player calling it
 * toggles their own client and nobody else's. The check is on the EMIT path rather than on
 * permissions, which is why granting a player ownership of a macro does not help.
 */
const access = (game: FoundryGame | undefined) => ({ getGame: () => game });

describe('isDesignatedGm', () => {
  /**
   * ⚠️ `activeGM` rather than `isGM`, and this is the whole point. Foundry picks the same single GM
   * on every client, deterministically. Using "am I a GM" would have EVERY connected GM answer the
   * same relayed request, flipping the pause once per GM and landing wherever the race ended. With
   * two GMs online that is a button that does nothing half the time, which is worse than one that
   * never works at all.
   */
  it('is true only for the ONE designated GM, not for every GM', () => {
    const chosen: FoundryGame = {
      users: { activeGM: { id: 'gm-1' } },
      user: { id: 'gm-1', isGM: true },
    };
    const otherGm: FoundryGame = {
      users: { activeGM: { id: 'gm-1' } },
      user: { id: 'gm-2', isGM: true },
    };

    expect(isDesignatedGm(access(chosen))).toBe(true);
    expect(isDesignatedGm(access(otherGm))).toBe(false);
  });

  it('is false for a player even when a GM is designated', () => {
    const player: FoundryGame = {
      users: { activeGM: { id: 'gm-1' } },
      user: { id: 'player-1', isGM: false },
    };

    expect(isDesignatedGm(access(player))).toBe(false);
  });

  /** Older builds have no activeGM, where plain isGM is still right for the usual single GM. */
  it('falls back to plain GM when Foundry designates nobody', () => {
    expect(isDesignatedGm(access({ user: { id: 'gm-1', isGM: true } }))).toBe(true);
    expect(isDesignatedGm(access({ user: { id: 'p', isGM: false } }))).toBe(false);
    expect(isDesignatedGm(access({ users: { activeGM: null }, user: { isGM: true } }))).toBe(true);
  });

  it('is false when there is no game at all', () => {
    expect(isDesignatedGm(access(undefined))).toBe(false);
  });
});

describe('applyPause', () => {
  /** broadcast is what tells every other client, and Foundry only honours it from a GM. */
  it('toggles with broadcast, which is the only part that reaches other clients', () => {
    const togglePause = vi.fn(() => true);

    applyPause(access({ togglePause }), true);

    expect(togglePause).toHaveBeenCalledWith(true, { broadcast: true });
  });

  it('does nothing rather than throwing when Foundry offers no toggle', () => {
    expect(() => {
      applyPause(access({}), true);
      applyPause(access(undefined), false);
    }).not.toThrow();
  });
});

describe('decidePauseAction', () => {
  /**
   * An authored macro wins, because a GM who wrote one meant it to be used, and keeping the
   * behaviour in the world's hands rather than hard coded here is what was asked for.
   */
  it("runs the world's own macro when there is one", () => {
    const execute = vi.fn();
    const game: FoundryGame = { macros: { getName: () => ({ execute, canExecute: true }) } };

    const action = decidePauseAction(access(game), 'Tongs Pause');

    expect(action.kind).toBe('runMacro');
    if (action.kind === 'runMacro') {
      action.execute();
    }
    expect(execute).toHaveBeenCalledOnce();
  });

  /**
   * A macro this user is not allowed to run must not be attempted. Trying anyway would throw inside
   * Foundry and produce nothing, where the relay would actually have worked.
   */
  it('relays instead when the macro exists but cannot be executed', () => {
    const game: FoundryGame = {
      macros: { getName: () => ({ execute: () => undefined, canExecute: false }) },
    };

    expect(decidePauseAction(access(game), 'Tongs Pause').kind).toBe('relay');
  });

  it('relays when there is no macro', () => {
    expect(decidePauseAction(access({ macros: { getName: () => null } }), 'x').kind).toBe('relay');
    expect(decidePauseAction(access({}), 'x').kind).toBe('relay');
  });

  it('does nothing when there is no game', () => {
    expect(decidePauseAction(access(undefined), 'x').kind).toBe('nothing');
  });
});
