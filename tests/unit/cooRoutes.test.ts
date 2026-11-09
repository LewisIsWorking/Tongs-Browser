import { describe, expect, it } from 'vitest';

import { cooPathsIn, missingRoutes } from '../../scripts/live/cooRoutes.ts';

describe('cooPathsIn', () => {
  it('finds quoted paths and fills template holes', () => {
    const paths = cooPathsIn(
      "call('/api/pathwars/players'); post(`/api/swap/${encodeURIComponent(id)}/decision`);"
    );

    expect(paths[0]).toBe('/api/pathwars/players');
    expect(paths[1]).toMatch(/^\/api\/swap\/[0-9a-f-]{36}\/decision$/);
  });

  it('lists a repeated path once', () => {
    expect(cooPathsIn('\'/api/a\' "/api/a"')).toEqual(['/api/a']);
  });

  it('ignores imports, prose and same-origin paths', () => {
    expect(cooPathsIn("from './api/thing.js'; // see /api/x for more\n'/coo-api/y'")).toEqual([]);
  });
});

describe('missingRoutes', () => {
  it('reports only a path neither verb is allowed on', async () => {
    const missing = await missingRoutes(['/post-only', '/get-only', '/gone'], (path, method) =>
      Promise.resolve(
        (path === '/post-only' && method === 'POST') || (path === '/get-only' && method === 'GET')
      )
    );

    expect(missing).toEqual(['/gone']);
  });

  it('lets a network failure surface instead of calling the route missing', async () => {
    await expect(missingRoutes(['/a'], () => Promise.reject(new Error('offline')))).rejects.toThrow(
      'offline'
    );
  });
});
