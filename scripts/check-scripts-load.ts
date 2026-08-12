#!/usr/bin/env node
/**
 * Can these scripts actually be LOADED by Node? Added 2026-08-12.
 *
 * ⚠️ `typecheck:scripts` cannot answer this, and believing it could left six harness checks unable to
 * run while every gate stayed green. Two separate reasons, both invisible to `tsc`:
 *
 * 1. **The import specifier.** These run through Node's type stripping, which resolves the REAL
 *    file, so a specifier must end `.ts`. TypeScript maps `./Thing.js` back to `./Thing.ts` and says
 *    nothing, and Node then cannot find `./Thing.js` because no such file exists. Splitting one file
 *    into seven introduced 27 of these in one commit.
 * 2. **Erasable syntax only.** Node STRIPS types rather than compiling them, so anything that emits
 *    code is rejected outright: parameter properties, enums, namespaces, decorators. A parameter
 *    property is ordinary TypeScript and `tsc` is perfectly happy with it. Node refuses the whole
 *    file with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`.
 *
 * ⚠️ This deliberately does NOT import anything. Importing runs the script, and these launch
 * browsers and write to a live world. It uses `module.stripTypeScriptTypes`, which is the exact
 * transform Node applies, and resolves the specifiers itself.
 *
 * Run: npm run check:scripts
 *      npm run check:scripts -- --self-test
 */
import { existsSync, readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

export interface LoadProblem {
  readonly file: string;
  readonly problem: string;
}

/** Every relative specifier in the file, with the position it appeared at. */
export function relativeSpecifiers(source: string): string[] {
  const found: string[] = [];
  const pattern = /(?:from|import)\s*\(?\s*['"](\.[^'"]*)['"]/g;
  let match = pattern.exec(source);
  while (match !== null) {
    if (match[1] !== undefined) {
      found.push(match[1]);
    }
    match = pattern.exec(source);
  }
  return found;
}

export function checkSource(file: string, source: string): LoadProblem[] {
  const problems: LoadProblem[] = [];

  try {
    stripTypeScriptTypes(source, { mode: 'strip' });
  } catch (error) {
    problems.push({
      file,
      problem: `Node cannot strip this: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  for (const specifier of relativeSpecifiers(source)) {
    /*
     * ⚠️ A `.js` specifier is the failure, not a missing file. TypeScript accepts it and silently
     * means the `.ts`; Node means exactly what it says and finds nothing.
     */
    if (specifier.endsWith('.js')) {
      problems.push({
        file,
        problem: `imports '${specifier}', which does not exist. Node needs the real extension: use '.ts'`,
      });
      continue;
    }
    if (specifier.endsWith('.ts') && !existsSync(resolve(dirname(file), specifier))) {
      problems.push({ file, problem: `imports '${specifier}', which is not on disk` });
    }
  }

  return problems;
}

/** ⚠️ Feed it both failures, so a guard that cannot fail is caught here rather than in a device run. */
function selfTest(): void {
  const wrongExtension = checkSource('x.ts', "import { a } from './b.js';");
  if (wrongExtension.length !== 1) {
    console.error('SELF TEST FAILED: a .js specifier was not reported');
    process.exit(1);
  }

  const notErasable = checkSource('x.ts', 'class A { constructor(private readonly b: number) {} }');
  if (notErasable.length !== 1) {
    console.error('SELF TEST FAILED: a parameter property was not reported');
    process.exit(1);
  }

  /*
   * ⚠️ A specifier that really exists. The first version of this pointed at a made up file, so the
   * existence check fired and the self test failed for the right reason on the wrong input. A
   * negative case has to be negative for EVERY check, not only the one being demonstrated.
   */
  const sound = "import { checkSource } from './check-scripts-load.ts';\nexport const c = 1;\n";
  if (checkSource('scripts/sample.ts', sound).length !== 0) {
    console.error('SELF TEST FAILED: an ordinary file was reported');
    process.exit(1);
  }

  console.log('Self test passed: both failures are caught and a sound file is not.');
}

if (process.argv.includes('--self-test')) {
  selfTest();
  process.exit(0);
}

/*
 * ⚠️ This file is skipped, and the reason is worth stating: a guard that CONTAINS EXAMPLES of what it
 * detects will detect itself. The self test samples here are string literals holding `'./b.js'` and a
 * parameter property, and the scanner cannot tell those from real imports without parsing, which is
 * far more machinery than the check is worth. The self test covers this file instead, which is the
 * better guarantee anyway: it proves the logic on both a failing and a sound input.
 */
const files = globSync('scripts/**/*.ts').filter(
  (file) => !file.endsWith('.d.ts') && !file.endsWith('check-scripts-load.ts')
);
const problems = files.flatMap((file) => checkSource(file, readFileSync(file, 'utf8')));

if (problems.length > 0) {
  console.error(`${String(problems.length)} script(s) Node could not load:\n`);
  for (const problem of problems) {
    console.error(`  ${problem.file}: ${problem.problem}`);
  }
  console.error('\nThese pass `tsc` and fail at run time. See the header of this file for why.');
  process.exit(1);
}

console.log(`All ${String(files.length)} scripts can be loaded by Node.`);
