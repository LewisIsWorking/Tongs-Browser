/**
 * Which exports nothing uses. Added 2026-08-19.
 *
 * ⚠️ WHY THIS EXISTS. Three files in a row were investigated for low coverage and the answer was the
 * same each time: the uncovered part was an exported value nothing called. A sweep then found ten,
 * and deleting one of them made a second dead by cascade. Coverage was the only thing pointing at
 * any of it, and coverage says "untested" when the truth is "unreachable" - two very different jobs.
 *
 * `check:support` already catches a shared TEST fixture that nothing imports. This is the same
 * question asked of production code.
 *
 * ⚠️ VALUES ONLY: functions, consts and classes. Types are deliberately exempt, and that is not
 * laziness. An `interface XOptions` naming a constructor's argument is referenced only inside its own
 * file whenever callers pass an object literal, which is almost always. Including types produced 64
 * findings of which the large majority were correct code; restricting to values produced 10, and all
 * 10 were real. A guard that cries wolf 54 times is a guard people learn to skip.
 */

export interface ExportSite {
  readonly file: string;
  readonly name: string;
}

export interface DeadExport extends ExportSite {
  /** Whether the file still uses it internally, which decides delete versus un-export. */
  readonly usedInternally: boolean;
}

/** Exported values, ignoring types. Matches the declaration form, not a re-export. */
const DECLARATION = /^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm;

export function findExportedValues(file: string, source: string): ExportSite[] {
  const found: ExportSite[] = [];
  for (const match of source.matchAll(DECLARATION)) {
    const name = match[1];
    if (name !== undefined) {
      found.push({ file, name });
    }
  }
  return found;
}

function mentions(source: string, name: string): boolean {
  return new RegExp(`\\b${name.replace(/[$]/g, '\\$')}\\b`).test(source);
}

/**
 * Exports no OTHER file mentions.
 *
 * ⚠️ Whole-word matching, and comments are not stripped. That direction is safe: a mention in a
 * comment makes this guard MISS a dead export, never invent one. The opposite bias would report a
 * live symbol as dead, which is the failure that gets a guard deleted rather than fixed.
 */
export function findDeadExports(
  sources: ReadonlyMap<string, string>,
  corpus: ReadonlyMap<string, string>
): DeadExport[] {
  const dead: DeadExport[] = [];

  for (const [file, source] of sources) {
    for (const site of findExportedValues(file, source)) {
      const usedElsewhere = [...corpus].some(
        ([other, text]) => other !== file && mentions(text, site.name)
      );
      if (usedElsewhere) continue;

      /*
       * Counting mentions beyond the declaration itself. One remaining use means the value is live
       * and merely over-exported, which is a one word fix; none means it is genuinely unreachable.
       */
      const uses = source.split(new RegExp(`\\b${site.name}\\b`)).length - 1;
      dead.push({ ...site, usedInternally: uses > 1 });
    }
  }

  return dead;
}

/** What to do about one finding, which differs enough to be worth saying. */
export function describeDeadExport(dead: DeadExport): string {
  return dead.usedInternally
    ? `${dead.file}: '${dead.name}' is exported but only used inside its own file - drop the export`
    : `${dead.file}: '${dead.name}' is exported and used nowhere at all - delete it`;
}

export function selfTest(): void {
  const fail = (message: string): never => {
    console.error(`SELF TEST FAILED: ${message}`);
    process.exit(1);
  };

  const sources = new Map([['src/a.ts', 'export function used() {}\nexport function dead() {}\n']]);
  const corpus = new Map([...sources, ['src/b.ts', 'used();\n']]);

  const dead = findDeadExports(sources, corpus);
  if (dead.length !== 1 || dead[0]?.name !== 'dead') {
    fail(`expected only 'dead', got ${dead.map((one) => one.name).join(',') || 'nothing'}`);
  }
  if (dead[0]?.usedInternally !== false) {
    fail('an export used nowhere was reported as used internally');
  }

  /* ⚠️ Over-exported is a different finding from unreachable, and must not be conflated. */
  const inner = new Map([
    ['src/c.ts', 'export const X = 1;\nconst y = X + 1;\nexport const z = y;\n'],
  ]);
  const innerDead = findDeadExports(inner, new Map([...inner, ['src/d.ts', 'z;\n']]));
  if (innerDead.length !== 1 || innerDead[0]?.usedInternally !== true) {
    fail('an export used inside its own file was not distinguished from an unreachable one');
  }

  /* ⚠️ Types are exempt: an Options interface is normally named only in its own file. */
  const typed = new Map([['src/e.ts', 'export interface Options { a: number }\n']]);
  if (findDeadExports(typed, typed).length !== 0) {
    fail('an exported type was reported, which would drown the real findings');
  }

  console.log(
    'Self test passed: values only, and over-exported is distinguished from unreachable.'
  );
}
