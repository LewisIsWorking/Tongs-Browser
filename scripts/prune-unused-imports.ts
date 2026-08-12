#!/usr/bin/env node
/**
 * Remove imports nothing uses, driven by the compiler rather than by a regex. Added 2026-08-12.
 *
 * ⚠️ Written after splitting one file into four cost four rounds of hand pruning. A regex looking for
 * the identifier in the body gets this wrong in both directions: it counts a name inside a
 * `describe('VirtualPointer hover', ...)` TITLE as a use, and it counts one inside a comment. Both
 * happened, and both left an import the compiler then rejected.
 *
 * TypeScript already knows the answer exactly. `TS6133` names the identifier and the position, so
 * this asks the compiler and edits what it points at.
 *
 * Run: npm run prune:imports        (checks src and tests)
 *      npm run prune:imports -- --scripts
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

interface Unused {
  readonly file: string;
  readonly line: number;
  /** Empty for a whole declaration, which TS reports as TS6192 without naming anything. */
  readonly name: string;
}

/** Ask the compiler which names are unused. It reports far more than imports, so this filters. */
export function parseUnused(diagnostics: string): Unused[] {
  const found: Unused[] = [];
  for (const line of diagnostics.split('\n')) {
    const named =
      /^(.+?)\((\d+),\d+\): error TS6133: '(.+?)' is declared but its value is never read\./.exec(
        line
      );
    if (named?.[1] !== undefined && named[2] !== undefined && named[3] !== undefined) {
      found.push({ file: named[1], line: Number(named[2]), name: named[3] });
      continue;
    }
    /*
     * ⚠️ TS6192 names nothing, because the whole declaration is unused. Handling only TS6133 leaves
     * these behind, which is exactly what happened: the pruner reported success and the build still
     * failed on three files.
     */
    const whole = /^(.+?)\((\d+),\d+\): error TS6192:/.exec(line);
    if (whole?.[1] !== undefined && whole[2] !== undefined) {
      found.push({ file: whole[1], line: Number(whole[2]), name: '' });
    }
  }
  return found;
}

/**
 * Drop one name from an import clause, or the whole statement when it was the only one.
 *
 * ⚠️ Returns the source UNCHANGED when the line is not an import. TS6133 also fires for unused
 * locals and parameters, and deleting one of those would silently change behaviour rather than
 * tidy it.
 */
export function dropImport(source: string, line: number, name: string): string {
  const lines = source.split('\n');

  // The clause may span several lines, so find the statement this line belongs to.
  let start = line - 1;
  while (start > 0 && !lines[start]?.trimStart().startsWith('import ')) {
    start -= 1;
  }
  if (!lines[start]?.trimStart().startsWith('import ')) {
    return source;
  }
  let end = start;
  while (end < lines.length && !lines[end]?.includes(';')) {
    end += 1;
  }

  const statement = lines.slice(start, end + 1).join('\n');

  /*
   * ⚠️ An empty name means TS6192: the WHOLE declaration is unused, so the whole declaration goes.
   * Without this branch the name-based path runs with an empty string, `includes('')` is true, and
   * the replacements below match at position zero and corrupt the statement rather than removing it.
   */
  if (name === '') {
    return [...lines.slice(0, start), ...lines.slice(end + 1)].join('\n');
  }

  if (!statement.includes(name)) {
    return source;
  }

  const remaining = statement
    .replace(new RegExp(`(^|[{,\\s])(type\\s+)?${name}\\s*,`), '$1')
    .replace(new RegExp(`,\\s*(type\\s+)?${name}(?=\\s*[},])`), '')
    .replace(new RegExp(`\\{\\s*(type\\s+)?${name}\\s*\\}`), '{}');

  // Nothing left to import, so the statement goes rather than being left as `import {} from`.
  const kept = /\{\s*\}/.test(remaining) && !remaining.includes(' * as ') ? '' : remaining;
  const rebuilt = [
    ...lines.slice(0, start),
    ...(kept === '' ? [] : [kept]),
    ...lines.slice(end + 1),
  ];
  return rebuilt.join('\n');
}

function run(project: string): string {
  try {
    execFileSync('npx', ['tsc', '-p', project, '--noEmit', '--pretty', 'false'], {
      encoding: 'utf8',
      shell: true,
    });
    return '';
  } catch (error) {
    return String((error as { stdout?: string }).stdout ?? '');
  }
}

const project = process.argv.includes('--scripts') ? 'tsconfig.scripts.json' : 'tsconfig.json';

let passes = 0;
let removed = 0;
while (passes < 5) {
  const unused = parseUnused(run(project));
  if (unused.length === 0) {
    break;
  }
  // ⚠️ Highest line first, so an edit cannot move the position of one not yet applied.
  const byFile = new Map<string, Unused[]>();
  for (const item of unused) {
    byFile.set(item.file, [...(byFile.get(item.file) ?? []), item]);
  }
  let changed = false;
  for (const [file, items] of byFile) {
    let source = readFileSync(file, 'utf8');
    for (const item of [...items].sort((a, b) => b.line - a.line)) {
      const next = dropImport(source, item.line, item.name);
      if (next !== source) {
        source = next;
        removed += 1;
        changed = true;
      }
    }
    writeFileSync(file, source, 'utf8');
  }
  if (!changed) {
    break;
  }
  passes += 1;
}

console.log(`Removed ${String(removed)} unused import(s) in ${String(passes)} pass(es).`);
