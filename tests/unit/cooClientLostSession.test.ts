import { describe, expect, it, vi } from 'vitest';

import { CooClient } from '../../src/bands/CooClient.js';
import type { BandPost, CooPorts } from '../../src/bands/CooClient.js';

/**
 * Losing the sign-in to ComeOnOverUno. Written 2026-10-13.
 *
 * ⚠️ FOUND ON C06: a sign-out in the COO web app ended every session on the account, Tongs's too. The next
 * refresh was refused, the client wiped the kept token and said nothing, so Lorn's 10 damage and every later
 * hit, band and tracker never reached Telegram while Lewis ran the fight.
 */
const POST: BandPost = {
  name: 'Goblin',
  segments: 6,
  word: 'Bloodied',
  hp: 17,
  maxHp: 28,
  announce: true,
  cause: 'manual change',
};

/** A COO whose refresh answers come from `refresh`, in order; every post is accepted. */
const server = (refresh: number[]) => {
  let stored = 'refresh-kept';
  const lostSession = vi.fn();
  const ports: CooPorts = {
    fetch: (url) => {
      const status = url.endsWith('/api/auth/refresh') ? (refresh.shift() ?? 200) : 200;
      const body = {
        accessToken: 'access',
        refreshToken: 'refresh-new',
        accessTokenExpiresAt: new Date(3_600_000).toISOString(),
      };
      return Promise.resolve({ status, json: () => Promise.resolve(body) });
    },
    serverUrl: () => 'https://coo.test',
    refreshToken: () => stored,
    saveRefreshToken: (token) => {
      stored = token;
      return Promise.resolve();
    },
    now: () => 0,
    lostSession,
  };
  return { ports, lostSession, stored: () => stored };
};

describe('losing the sign-in', () => {
  it('tells the GM once when COO refuses the kept sign-in', async () => {
    const coo = server([401]);
    const client = new CooClient(coo.ports);

    expect(await client.postBand('C06', POST)).toBe('signed-out');
    expect(await client.postBand('C06', POST)).toBe('signed-out');

    expect(coo.stored()).toBe('');
    expect(coo.lostSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the sign-in through a server error, such as a 502 while COO redeploys', async () => {
    const coo = server([502]);
    const client = new CooClient(coo.ports);

    expect(await client.postBand('C06', POST)).toBe('signed-out');
    expect(coo.stored()).toBe('refresh-kept');
    expect(coo.lostSession).not.toHaveBeenCalled();

    expect(await client.postBand('C06', POST)).toBe('sent');
  });
});
