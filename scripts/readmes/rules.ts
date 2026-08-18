/**
 * What counts as a folder being documented. Added 2026-08-18.
 *
 * Separated from the command line so the rules can be tested against made up inputs rather than
 * against whatever the repository happens to look like today. A guard proved only by the repo passing
 * is a guard that stops proving anything the moment the repo is clean.
 *
 * ⚠️ EXISTENCE IS NOT THE RULE, and that distinction is the whole point of this file. A guard that
 * checks for a README.md and nothing else is a guard that asks for twenty-six files and gets twenty-six
 * files saying "This folder contains helpers." Then the check is green forever, the rule looks
 * enforced, and nobody has learned anything. That is the shape of every gap in this repo's history
 * where something was stored, displayed, tested, green, and never actually happened.
 *
 * So a README must NAME AT LEAST ONE FILE that genuinely lives in the folder. It is a cheap rule and
 * it cannot be satisfied by boilerplate, because the filenames differ per folder and a writer who
 * lists them has had to look at what is in there.
 */

/** A folder, its tracked source files, and its README if it has one. */
export interface FolderDoc {
  readonly folder: string;
  readonly files: readonly string[];
  readonly readme: string | null;
}

export interface ReadmeProblem {
  readonly folder: string;
  readonly reason: 'has no README.md' | 'names none of its own files';
  readonly detail: string;
}

/** Bare filenames, which is what a README would sensibly mention. */
function basenames(files: readonly string[]): string[] {
  return files.map((file) => file.slice(file.lastIndexOf('/') + 1));
}

/**
 * Every way a folder can fail to be documented.
 *
 * ⚠️ Folders in `backlog` are skipped entirely, exactly as the file size ratchet skips its own. The
 * rule arrived long after the code did, so demanding all of it in one commit would mean twenty-six
 * READMEs written in one sitting by someone who wanted to be doing something else. That is how the
 * filler this file exists to prevent gets written.
 */
export function findReadmeProblems(
  docs: readonly FolderDoc[],
  backlog: readonly string[] = []
): ReadmeProblem[] {
  const excused = new Set(backlog);
  const problems: ReadmeProblem[] = [];

  for (const doc of docs) {
    if (excused.has(doc.folder)) continue;

    if (doc.readme === null) {
      problems.push({
        folder: doc.folder,
        reason: 'has no README.md',
        detail: `${String(doc.files.length)} source file(s) and nothing saying what they are for`,
      });
      continue;
    }

    const named = basenames(doc.files).filter((name) => doc.readme?.includes(name));
    if (named.length === 0) {
      problems.push({
        folder: doc.folder,
        reason: 'names none of its own files',
        detail:
          `the README mentions none of ${basenames(doc.files).slice(0, 4).join(', ')}` +
          `${doc.files.length > 4 ? ', ...' : ''}, so it is not describing this folder`,
      });
    }
  }

  return problems;
}

/**
 * The backlog with every folder that now passes removed.
 *
 * ⚠️ Reductions only, same discipline as the file size ratchet: a folder is dropped when it has a
 * README that names its own files, and nothing here can ever ADD one. A backlog that can grow is
 * permission rather than a plan.
 */
export function tightenedBacklog(docs: readonly FolderDoc[], backlog: readonly string[]): string[] {
  const stillFailing = new Set(findReadmeProblems(docs, []).map((problem) => problem.folder));
  const known = new Set(docs.map((doc) => doc.folder));
  return backlog
    .filter((folder) => known.has(folder) && stillFailing.has(folder))
    .sort((left, right) => left.localeCompare(right));
}

/** Backlog entries naming a folder that no longer holds source, so the list cannot rot. */
export function staleBacklogEntries(
  docs: readonly FolderDoc[],
  backlog: readonly string[]
): string[] {
  const known = new Set(docs.map((doc) => doc.folder));
  return backlog.filter((folder) => !known.has(folder));
}

/**
 * The rules, proved against made up folders.
 *
 * ⚠️ Wired into `npm run check:readmes` so it actually runs. The size guard shipped a `--self-test`
 * that appeared in no npm script and no workflow, and therefore had never once executed; a proof
 * nobody invokes cannot fail, which is the same as not having one.
 */
export function selfTest(): void {
  const fail = (message: string): never => {
    console.error(`SELF TEST FAILED: ${message}`);
    process.exit(1);
  };

  const missing: FolderDoc = { folder: 'src/a', files: ['src/a/One.ts'], readme: null };
  if (findReadmeProblems([missing])[0]?.reason !== 'has no README.md') {
    fail('a folder with no README was not reported');
  }

  /* ⚠️ The rule that makes this worth having: boilerplate must NOT pass. */
  const filler: FolderDoc = {
    folder: 'src/a',
    files: ['src/a/One.ts'],
    readme: '# src/a\n\nThis folder contains helpers.\n',
  };
  if (findReadmeProblems([filler])[0]?.reason !== 'names none of its own files') {
    fail('a README naming none of its own files was accepted');
  }

  const real: FolderDoc = {
    folder: 'src/a',
    files: ['src/a/One.ts'],
    readme: '# src/a\n\n`One.ts` does the thing.\n',
  };
  if (findReadmeProblems([real]).length !== 0) {
    fail('a README naming its own file was rejected');
  }

  if (findReadmeProblems([missing], ['src/a']).length !== 0) {
    fail('a backlogged folder was still reported');
  }

  /* ⚠️ The backlog may only ever shrink. */
  if (tightenedBacklog([real], ['src/a']).length !== 0) {
    fail('a folder that now passes was kept on the backlog');
  }
  if (tightenedBacklog([missing], ['src/a']).join(',') !== 'src/a') {
    fail('a folder that still fails was dropped from the backlog');
  }
  if (staleBacklogEntries([real], ['src/gone']).join(',') !== 'src/gone') {
    fail('a backlog entry for a vanished folder was not reported');
  }

  console.log('Self test passed: boilerplate fails, and the backlog only ever shrinks.');
}
