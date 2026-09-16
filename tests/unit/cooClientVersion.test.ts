import { describe, expect, it } from 'vitest';

import { CooClient } from '../../src/bands/CooClient.js';
import type { CooPorts } from '../../src/bands/CooClient.js';
import { buildCooClient } from '../../src/bands/startBands.js';

/**
 * The Tongs version on every signed-in post, so ComeOnOverUno can show what sent a message. Asked for by Lewis
 * 2026-09-16, for debugging from Telegram.
 */
const recording = (version?: () => string) => {
  const bodies: unknown[] = [];
  const ports: CooPorts = {
    fetch: (url, init) => {
      if (!url.endsWith('/refresh'))
        bodies.push(init.body === undefined ? undefined : JSON.parse(init.body));
      const tokens = {
        accessToken: 'a',
        refreshToken: 'r2',
        accessTokenExpiresAt: new Date(3_600_000).toISOString(),
      };
      return Promise.resolve({ status: 200, json: () => Promise.resolve(tokens) });
    },
    serverUrl: () => 'https://coo.test',
    refreshToken: () => 'r1',
    saveRefreshToken: () => Promise.resolve(),
    now: () => 0,
    ...(version === undefined ? {} : { version }),
  };
  return { ports, bodies };
};

describe('the Tongs version on a post', () => {
  it('is stamped on each signed-in post body, and never invented', async () => {
    const known = recording(() => '0.39.0');
    await new CooClient(known.ports).call('POST', '/api/x', { round: 1 });
    await new CooClient(known.ports).call('GET', '/api/y');
    expect(known.bodies).toEqual([{ round: 1, tongsVersion: '0.39.0' }, undefined]);

    const unknown = recording();
    await new CooClient(unknown.ports).call('POST', '/api/x', {});
    expect(unknown.bodies).toEqual([{ tongsVersion: 'unknown' }]);
  });

  it("is read from Foundry's module entry by the client Tongs builds", async () => {
    let body: unknown;
    const client = buildCooClient(
      {
        register: () => undefined,
        get: (_s, key) => (key === 'cooRefreshToken' ? 'r1' : ''),
        set: () => Promise.resolve(),
      },
      {
        game: {
          modules: {
            get: (id: string) => (id === 'tongs-browser' ? { version: '0.39.0' } : undefined),
          },
        },
        fetch: (url, init) => {
          if (url.endsWith('/combat-band')) body = JSON.parse(init.body ?? '{}');
          const tokens = {
            accessToken: 'a',
            refreshToken: 'r2',
            accessTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          };
          return Promise.resolve({ status: 200, json: () => Promise.resolve(tokens) });
        },
      }
    );
    await client.postBand('C09', {
      name: 'Ovvat',
      segments: 0,
      word: 'Down',
      hp: 0,
      maxHp: 10,
      announce: true,
      cause: 'x',
    });
    expect(body).toMatchObject({ tongsVersion: '0.39.0' });
  });
});
