#!/usr/bin/env node
/**
 * Does COO accept, from a browser on Foundry's origin, every path Tongs calls? Added 2026-11-08.
 *
 * COVERS: a route that never shipped, or that lacks the Foundry CORS policy.
 * MISSES: a route that exists but expects a different body, and any path built from parts rather
 *   than quoted whole in `src/`.
 *
 * Sends preflights only, so it writes nothing and needs no sign-in. A network failure throws rather
 * than reading as a missing route.
 *
 * Run: npm run check:routes (COO_URL and FOUNDRY_ORIGIN override the live hosts)
 */
import { readFileSync } from 'node:fs';

import { cooPathsIn, missingRoutes } from './live/cooRoutes.ts';
import type { Preflight } from './live/cooRoutes.ts';
import { listSourceFiles } from './sizes/listing.ts';

const COO = process.env.COO_URL ?? 'https://cooserver.duckdns.org';
const ORIGIN = process.env.FOUNDRY_ORIGIN ?? 'https://foundry.cooserver.duckdns.org';

const allows: Preflight = async (path, method) => {
  const response = await fetch(`${COO}${path}`, {
    method: 'OPTIONS',
    headers: {
      Origin: ORIGIN,
      'Access-Control-Request-Method': method,
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  return response.headers.get('access-control-allow-origin') === ORIGIN;
};

const sources = listSourceFiles().filter((file) => file.startsWith('src/'));
const paths = [...new Set(sources.flatMap((file) => cooPathsIn(readFileSync(file, 'utf8'))))];
const missing = await missingRoutes(paths, allows);

if (missing.length > 0) {
  console.error(`COO refuses ${String(missing.length)} of ${String(paths.length)} paths:\n`);
  for (const path of missing) {
    console.error(`  ${path}`);
  }
  // ⚠️ Not process.exit: on Windows it aborts Node while fetch still holds its handles open.
  process.exitCode = 1;
} else {
  console.log(`COO accepts all ${String(paths.length)} paths Tongs calls.`);
}
