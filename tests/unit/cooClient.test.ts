import { describe, expect, it } from 'vitest';

import { CooClient } from '../../src/bands/CooClient.js';
import type { BandPost, CooPorts } from '../../src/bands/CooClient.js';

/**
 * Signing in to ComeOnOverUno and posting bands, against a fake server. Written 2026-09-14.
 *
 * ⚠️ The fake ROTATES refresh tokens like COO does: each refresh token works once. That is what makes
 * the one-refresh-at-a-time rule testable.
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
const HOUR = 3_600_000;

const server = (
  options: { bandStatus?: number[]; loginOk?: boolean; tokensInReply?: boolean } = {}
) => {
  let stored = '';
  let issued = 0;
  const valid = new Set<string>();
  const calls: string[] = [];
  const bandStatus = [...(options.bandStatus ?? [])];
  const tokens = () => {
    issued += 1;
    valid.add(`refresh-${String(issued)}`);
    return options.tokensInReply === false
      ? {}
      : {
          accessToken: `access-${String(issued)}`,
          refreshToken: `refresh-${String(issued)}`,
          accessTokenExpiresAt: new Date(HOUR).toISOString(),
        };
  };
  const reply = (status: number, body: unknown = {}) =>
    Promise.resolve({ status, json: () => Promise.resolve(body) });
  const ports: CooPorts = {
    fetch: async (url, init) => {
      const body = JSON.parse(init.body ?? '{}') as { refreshToken?: string };
      calls.push(
        `${url.replace('https://coo.test', '')} ${init.headers['Authorization'] ?? ''}`.trim()
      );
      if (url.endsWith('/api/auth/login')) {
        return options.loginOk === false ? reply(401) : reply(200, tokens());
      }
      if (url.endsWith('/api/auth/refresh')) {
        const ok = body.refreshToken !== undefined && valid.delete(body.refreshToken);
        return ok ? reply(200, tokens()) : reply(401);
      }
      return reply(bandStatus.shift() ?? 200);
    },
    serverUrl: () => 'https://coo.test/',
    refreshToken: () => stored,
    saveRefreshToken: (token) => {
      stored = token;
      return Promise.resolve();
    },
    now: () => 0,
  };
  return {
    ports,
    calls,
    stored: () => stored,
    grant: () => valid.add((stored = 'refresh-granted')),
  };
};

describe('signing in', () => {
  it('keeps only the refresh token COO returns, and says when COO refused', async () => {
    const ok = server();
    expect(await new CooClient(ok.ports).signIn('lewis', 'secret')).toBe(true);
    expect(ok.stored()).toBe('refresh-1');

    const refused = server({ loginOk: false });
    expect(await new CooClient(refused.ports).signIn('lewis', 'wrong')).toBe(false);
    expect(await new CooClient(server({ tokensInReply: false }).ports).signIn('lewis', 'x')).toBe(
      false
    );
  });
});

describe('posting a band', () => {
  it('refreshes once, then reuses the access token until it is about to expire', async () => {
    const fake = server();
    fake.grant();
    const client = new CooClient(fake.ports);

    expect(await client.postBand('C06', POST)).toBe('sent');
    expect(await client.postBand('C06', POST)).toBe('sent');

    expect(fake.calls).toEqual([
      '/api/auth/refresh',
      '/api/pathwars/campaigns/C06/combat-band Bearer access-1',
      '/api/pathwars/campaigns/C06/combat-band Bearer access-1',
    ]);
  });

  /* ⛔ COO rotates refresh tokens: two refreshes at once would sign the GM out. */
  it('shares one refresh between posts made at the same moment', async () => {
    const fake = server();
    fake.grant();
    const client = new CooClient(fake.ports);

    expect(await Promise.all([client.postBand('C06', POST), client.postBand('C06', POST)])).toEqual(
      ['sent', 'sent']
    );
    expect(fake.calls.filter((call) => call.includes('refresh'))).toHaveLength(1);
  });

  it('refreshes and retries once when COO says the token is no longer good', async () => {
    const fake = server({ bandStatus: [401, 200] });
    fake.grant();

    expect(await new CooClient(fake.ports).postBand('C 6', POST)).toBe('sent');
    expect(fake.calls.at(-1)).toBe('/api/pathwars/campaigns/C%206/combat-band Bearer access-2');
  });

  it('is signed out with no session, a refused refresh, or a second refusal; failed on any other answer', async () => {
    expect(await new CooClient(server().ports).postBand('C06', POST)).toBe('signed-out');

    const spent = server();
    spent.grant();
    const client = new CooClient(spent.ports);
    await client.postBand('C06', POST);
    expect(
      await new CooClient({ ...spent.ports, refreshToken: () => 'refresh-granted' }).postBand(
        'C06',
        POST
      )
    ).toBe('signed-out');

    const refusing = server({ bandStatus: [401, 401] });
    refusing.grant();
    expect(await new CooClient(refusing.ports).postBand('C06', POST)).toBe('signed-out');

    const missing = server({ bandStatus: [404] });
    missing.grant();
    expect(await new CooClient(missing.ports).postBand('C99', POST)).toBe('failed');
  });

  it('forgets a session COO no longer accepts, and refreshes every time without an expiry', async () => {
    const stale = server();
    await stale.ports.saveRefreshToken('refresh-unknown');
    await new CooClient(stale.ports).postBand('C06', POST);
    expect(stale.stored()).toBe('');

    const noExpiry = server();
    noExpiry.grant();
    const client = new CooClient({
      ...noExpiry.ports,
      fetch: async (url, init) => {
        const response = await noExpiry.ports.fetch(url, init);
        const body = (await response.json()) as Record<string, unknown>;
        return {
          status: response.status,
          json: () => Promise.resolve({ ...body, accessTokenExpiresAt: undefined }),
        };
      },
    });
    await client.postBand('C06', POST);
    await client.postBand('C06', POST);
    expect(noExpiry.calls.filter((call) => call.includes('refresh'))).toHaveLength(2);
  });
});
