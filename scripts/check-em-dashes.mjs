#!/usr/bin/env node
/**
 * Project convention: em dashes are banned everywhere. Source, comments, docs, UI strings, all of
 * it. Use a period, a comma, or a colon instead.
 *
 * Prettier has no option controlling this, so it cannot be enforced by the formatter. A dedicated
 * check is used instead, and it runs over every tracked text file rather than only the TypeScript
 * that ESLint sees, because prose in markdown is where em dashes actually creep in.
 *
 * The character is built from its code point rather than typed literally, so this file does not
 * trip its own check.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const EM_DASH = String.fromCodePoint(0x2014);

const SCANNED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.css',
  '.html',
  '.yml',
  '.yaml',
]);

/**
 * Includes files that are tracked and files that are new but not ignored. Checking only tracked
 * files would let a brand new document pass locally right up until the moment it is committed.
 */
function candidateFiles() {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  });
  return [...new Set(output.split('\n').filter((line) => line.length > 0))];
}

function findOccurrences(path) {
  let contents;
  try {
    contents = readFileSync(path, 'utf8');
  } catch {
    // Deleted but still tracked, or unreadable. Nothing to check.
    return [];
  }

  const hits = [];
  contents.split('\n').forEach((line, lineIndex) => {
    let column = line.indexOf(EM_DASH);
    while (column !== -1) {
      hits.push({ path, line: lineIndex + 1, column: column + 1, text: line.trim() });
      column = line.indexOf(EM_DASH, column + 1);
    }
  });
  return hits;
}

const scanned = candidateFiles().filter((path) => SCANNED_EXTENSIONS.has(extname(path)));
const violations = scanned.flatMap(findOccurrences);

if (violations.length > 0) {
  console.error(`Found ${violations.length} em dash occurrence(s). Use a period, comma, or colon.`);
  console.error('');
  for (const hit of violations) {
    console.error(`  ${hit.path}:${hit.line}:${hit.column}`);
    console.error(`    ${hit.text}`);
  }
  process.exit(1);
}

console.log(`No em dashes found across ${scanned.length} files.`);
