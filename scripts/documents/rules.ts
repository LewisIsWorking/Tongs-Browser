/**
 * Where the module is allowed to enumerate Foundry documents. Added 2026-09-01.
 *
 * ⚠️ Listing documents is the one thing this module does that can leak. Everything else it does is
 * about a pointer: it moves, clicks and scales, and none of that can tell a player the NAME of a
 * sheet, party or folder they were never meant to know exists.
 *
 * Audited 2026-09-01, before the sheet-creation feature added its first picker: `src/` enumerated
 * NOTHING. The only `game.users` reference was `activeGM`, a single lookup. The sidebar picker lists
 * Foundry's own tab names, filtered by `gmOnly`, and that filter is tested in both directions. So the
 * requirement "users should never see sheets, parties or folders they have no permission to see" was
 * satisfied by construction, because there was no listing anywhere to get wrong.
 *
 * The pickers change that. This guard keeps every future listing behind ONE boundary, so the
 * permission filter is written once and cannot be forgotten by the second picker somebody adds. It is
 * the same shape as `ActionableTouches`, which filters excluded fingers at a single boundary rather
 * than at each call site, for the same reason: a rule applied in N places is a rule applied in N-1
 * places eventually.
 */

/** Collection accesses that hand back documents the current user may not be allowed to see. */
const ENUMERATIONS: readonly { readonly pattern: RegExp; readonly what: string }[] = [
  { pattern: /\bgame\??\.\s*actors\b/, what: 'game.actors' },
  { pattern: /\bgame\??\.\s*folders\b/, what: 'game.folders' },
  { pattern: /\bgame\??\.\s*journal\b/, what: 'game.journal' },
  { pattern: /\bgame\??\.\s*scenes\b/, what: 'game.scenes' },
  { pattern: /\bgame\??\.\s*items\b/, what: 'game.items' },
  /*
   * ⚠️ `game.users` is listed but `activeGM` is NOT an enumeration: it is one lookup of one user, by
   * Foundry's own rule, and the relay depends on it. Excluded by the caller rather than here, so the
   * exception is visible at the point that grants it.
   */
  { pattern: /\bgame\??\.\s*users\b/, what: 'game.users' },
];

/** ⚠️ `activeGM` is a single designated user, not a list, and the pause relay cannot work without it. */
const ALLOWED_USES: readonly RegExp[] = [/\bgame\??\.\s*users\??\.\s*activeGM\b/];

export interface DocumentAccess {
  readonly file: string;
  readonly line: number;
  readonly what: string;
  readonly text: string;
}

/**
 * Every document enumeration in a file, ignoring comments.
 *
 * ⚠️ Comments are stripped, because this file and the docs describe the very patterns it looks for.
 * A guard that flags the prose explaining it is a guard that gets switched off. Learned the hard way
 * on `guardListing.test.ts`, where two guards failed a check for mentioning `ls-files` in a comment.
 */
export function findDocumentAccess(source: string, file: string): DocumentAccess[] {
  /*
   * ⚠️ Comments are BLANKED IN PLACE, not deleted, and the difference is the line number.
   *
   * Deleting a block comment removes its newlines, so every line after it shifts up and the reported
   * position is wrong by however many lines of prose came before. This guard's first run reported a
   * real finding at line 98 that actually lived at line 143 - a forty-five line lie, pointing at an
   * unrelated function, in the one field a reader uses to go and look.
   *
   * Replacing each comment character with a space keeps the line count identical, so the number in
   * the report is the number in the editor.
   */
  const blankOut = (match: string): string => match.replace(/[^\n]/g, ' ');
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, blankOut)
    .replace(/^\s*\/\/.*$/gm, blankOut)
    .replace(/([^:])\/\/.*$/gm, (match, keep: string) => keep + blankOut(match.slice(1)));

  const found: DocumentAccess[] = [];
  withoutComments.split('\n').forEach((line, index) => {
    if (ALLOWED_USES.some((allowed) => allowed.test(line))) {
      return;
    }
    for (const { pattern, what } of ENUMERATIONS) {
      if (pattern.test(line)) {
        found.push({ file, line: index + 1, what, text: line.trim().slice(0, 80) });
      }
    }
  });
  return found;
}

/**
 * ⚠️ Feed it a violation AND an allowed use, so a guard that cannot fire is caught here rather than
 * by a leak on somebody's phone. A guard with no offenders in the repo - which is exactly the state
 * this one ships in - is otherwise indistinguishable from a guard that matches nothing at all.
 */
export function selfTest(): void {
  const leaks = findDocumentAccess('const all = game.actors.contents;', 'sample.ts');
  if (leaks.length !== 1) {
    console.error(`SELF TEST FAILED: game.actors was not reported (got ${String(leaks.length)})`);
    process.exit(1);
  }

  const relay = findDocumentAccess('const gm = game.users?.activeGM ?? null;', 'sample.ts');
  if (relay.length !== 0) {
    console.error('SELF TEST FAILED: activeGM is a single lookup and must be allowed');
    process.exit(1);
  }

  const commented = findDocumentAccess('// reads game.folders one day', 'sample.ts');
  if (commented.length !== 0) {
    console.error('SELF TEST FAILED: a comment mentioning the pattern was reported as a use');
    process.exit(1);
  }

  /**
   * ⚠️ The LINE NUMBER, because it was wrong on this guard's first run and a wrong line number is
   * worse than none: it sends the reader to an unrelated function and makes the finding look false.
   * A multi-line comment above the offence is the case that broke it.
   */
  const afterComment = findDocumentAccess(
    ['/*', ' * three', ' * lines', ' */', 'const all = game.actors;'].join('\n'),
    'sample.ts'
  );
  if (afterComment[0]?.line !== 5) {
    console.error(
      `SELF TEST FAILED: expected the finding on line 5, got ${String(afterComment[0]?.line)}`
    );
    process.exit(1);
  }

  console.log('Self test passed: a real enumeration fails, activeGM and a comment do not, line 5.');
}
