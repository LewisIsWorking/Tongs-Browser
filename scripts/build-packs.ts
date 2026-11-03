#!/usr/bin/env node
/**
 * Compiles every pack source folder under packs-src/ into a Foundry LevelDB pack under packs/.
 * Added 2026-11-03, for the "Tongs Macros" compendium.
 *
 * ⚠️ The output folder is deleted first. compilePack writes into an existing LevelDB, so a document
 *    removed from the sources would otherwise live on in the shipped pack.
 *
 * Run: npm run build:packs
 */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { compilePack } from '@foundryvtt/foundryvtt-cli';

const SOURCE_ROOT = 'packs-src';
const OUTPUT_ROOT = 'packs';

const folders = readdirSync(SOURCE_ROOT).filter((name) =>
  statSync(join(SOURCE_ROOT, name)).isDirectory()
);

for (const folder of folders) {
  const output = join(OUTPUT_ROOT, folder);
  if (existsSync(output)) {
    rmSync(output, { recursive: true, force: true });
  }
  await compilePack(join(SOURCE_ROOT, folder), output, { log: true });
  console.log(`Built pack ${output}`);
}
