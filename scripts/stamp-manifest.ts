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

/*
 * ⚠️ `manifest` MUST NOT point at a source this script never stamps, and for 25 releases it did.
 *
 * Foundry polls the installed module's `manifest` URL and compares the `version` it finds there
 * against the installed one. That field pointed at `raw.githubusercontent.com/.../main/module.json`,
 * and the copy on main is deliberately left at the `0.1.0` placeholder because only the copy inside
 * module.zip is stamped. So every install polled a file that said 0.1.0 forever and concluded there
 * was nothing newer. Measured 2026-08-30 against the live URLs: the shipped zip said 0.25.67 and its
 * own manifest URL said 0.1.0.
 *
 * The release now uploads a stamped module.json as an asset, so `releases/latest/download` serves
 * the newest one. Anything under `/main/` or `raw.githubusercontent.com` is unstamped by definition
 * and is rejected here rather than discovered as a module that silently never updates.
 */
const pollable = String(manifest.manifest);
if (pollable.includes('raw.githubusercontent.com') || pollable.includes('/main/')) {
  console.error(`The 'manifest' URL points at an unstamped source: ${pollable}`);
  console.error('Foundry polls this URL for updates. A source that is never stamped reports the');
  console.error('placeholder version forever, so no install can ever see an update.');
  console.error('Point it at releases/latest/download/module.json.');
  process.exit(1);
}

writeFileSync('module.json', `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`module.json stamped to ${version}`);
console.log(`  download: ${manifest.download}`);
console.log(`  update poll: ${pollable}`);
