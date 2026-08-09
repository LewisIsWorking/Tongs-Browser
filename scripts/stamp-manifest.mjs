#!/usr/bin/env node
/**
 * Rewrites module.json for a release.
 *
 * The manifest on main points `download` at releases/latest/download, which is what makes the
 * install URL stable across versions. The copy shipped inside module.zip is stamped to the exact
 * tag instead, so an installed module reports the version it actually is and updates resolve
 * against a fixed asset rather than a moving target.
 *
 * Reads VERSION and REPO from the environment. Both are required, and the script fails loudly
 * rather than writing a manifest with "undefined" in the URL, because that failure would only
 * surface later as an install error with no obvious cause.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.env.VERSION;
const repo = process.env.REPO;

if (!version || !repo) {
  console.error('VERSION and REPO must both be set. Received:', { version, repo });
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`VERSION does not look like a version number: ${version}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync('module.json', 'utf8'));
manifest.version = version;
manifest.download = `https://github.com/${repo}/releases/download/v${version}/module.zip`;

writeFileSync('module.json', `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`module.json stamped to ${version}`);
console.log(`  download: ${manifest.download}`);
