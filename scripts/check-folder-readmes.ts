#!/usr/bin/env node
/**
 * Every folder holding source says what it is for. Added 2026-08-18.
 *
 * ⚠️ A README that exists and says nothing is worse than no README, because it turns the check green
 * and stops anyone asking again. So the rule is not "a README.md exists": it is that the README NAMES
 * AT LEAST ONE FILE that genuinely lives in that folder. Cheap to satisfy honestly, impossible to
 * satisfy with boilerplate, since the filenames differ per folder. See scripts/readmes/rules.ts.
 *
 * ⚠️ Folders still undocumented are held in a BACKLOG that can only shrink, the same discipline as
 * the file size ratchet, and for the same reason: the rule arrived long after the code, and demanding
 * twenty-six READMEs in one commit is how filler gets written. `--update` drops every folder that now
 * passes and can never add one.
 *
 * ⚠️ FLAGS GO THROUGH `node`, NOT `npm run ... --`. npm 12 parses unknown flags itself even after the
 * `--` separator and exits before this file runs. Measured 2026-08-18 on check:sizes.
 *
 * Run: npm run check:readmes                          (self test, then the repository)
 *      node scripts/check-folder-readmes.ts --update  (after documenting a folder)
 *      node scripts/check-folder-readmes.ts --self-test
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import {
  findReadmeProblems,
  selfTest,
  staleBacklogEntries,
  tightenedBacklog,
  type FolderDoc,
} from './readmes/rules.ts';

const BACKLOG_FILE = 'scripts/folder-readme-backlog.json';

if (process.argv.includes('--self-test')) {
  selfTest();
  process.exit(0);
}

const tracked = execFileSync('git', ['ls-files', '*.ts'], { encoding: 'utf8' })
  .split('\n')
  .filter((file) => file !== '' && !file.endsWith('.d.ts'));

/*
 * Grouped by the folder each file sits in DIRECTLY, not recursively. A parent's README saying "see the
 * subfolders" would otherwise excuse every child, which is the failure mode where one document claims
 * coverage of code it never mentions.
 */
const byFolder = new Map<string, string[]>();
for (const file of tracked) {
  const cut = file.lastIndexOf('/');
  /*
   * ⚠️ `-1` means the repository ROOT, not a folder, and the naive slice turns it into one. Seeding
   * produced the folders `playwright.config.t`, `vite.config.t` and `vitest.config.t` - each the
   * filename with its last character shaved off, because `slice(0, -1)` drops one character rather
   * than returning ''. Three plausible looking entries that name nothing. The root has the top level
   * README.md and is not a source folder, so it is skipped.
   */
  if (cut === -1) continue;
  const folder = file.slice(0, cut);
  byFolder.set(folder, [...(byFolder.get(folder) ?? []), file]);
}

const docs: FolderDoc[] = [...byFolder.entries()]
  .map(([folder, files]) => {
    const path = `${folder}/README.md`;
    return { folder, files, readme: existsSync(path) ? readFileSync(path, 'utf8') : null };
  })
  .sort((left, right) => left.folder.localeCompare(right.folder));

const backlog: string[] = existsSync(BACKLOG_FILE)
  ? (JSON.parse(readFileSync(BACKLOG_FILE, 'utf8')) as string[])
  : [];

/*
 * ⚠️ `--seed` is separate from `--update` and deliberately awkward to reach for, for the reason the
 * file size ratchet gives: seeding is the one-time act of writing the backlog down, and it is the
 * only mode that can record a folder as excused. Keeping it behind its own flag means nobody reaches
 * for it to make a failing check go away.
 */
if (process.argv.includes('--seed')) {
  const seeded = findReadmeProblems(docs, []).map((problem) => problem.folder);
  writeFileSync(BACKLOG_FILE, `${JSON.stringify(seeded, null, 2)}\n`);
  console.log(`Seeded a backlog of ${String(seeded.length)} undocumented folder(s).`);
  process.exit(0);
}

if (process.argv.includes('--update')) {
  const next = tightenedBacklog(docs, backlog);
  writeFileSync(BACKLOG_FILE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(
    `Recorded ${String(next.length)} folder(s) still undocumented, down from ${String(backlog.length)}.`
  );
  process.exit(0);
}

/*
 * A backlog entry for a folder that no longer holds source is not harmless: it is an excuse attached
 * to nothing, and it keeps the count looking like work remains when it does not.
 */
const stale = staleBacklogEntries(docs, backlog);
if (stale.length > 0) {
  console.error(`${String(stale.length)} backlog entr(y/ies) name a folder with no source:\n`);
  for (const folder of stale) console.error(`  ${folder}`);
  console.error('\nRun `node scripts/check-folder-readmes.ts --update` to drop them.');
  process.exit(1);
}

const problems = findReadmeProblems(docs, backlog);
if (problems.length > 0) {
  console.error(`${String(problems.length)} folder(s) not documented:\n`);
  for (const problem of problems) {
    console.error(`  ${problem.folder}: ${problem.reason} - ${problem.detail}`);
  }
  console.error(
    '\nWrite a README.md that names the files and says what the folder is for.' +
      '\nA README that names none of its own files is boilerplate, and this check will say so.'
  );
  process.exit(1);
}

/*
 * The backlog count is printed on SUCCESS on purpose. A guard that says only "all good" while holding
 * a list of known gaps is telling half the truth, and the half it leaves out is the half that needs
 * doing. Same reason check:sizes prints its remaining backlog.
 */
const documented = docs.length - backlog.length;
console.log(
  `${String(documented)} of ${String(docs.length)} source folder(s) documented; ` +
    `${String(backlog.length)} still on the backlog.`
);
