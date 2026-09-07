/**
 * Reading the module's own controls out of its source. Added 2026-09-07.
 *
 * ⚠️ Text, not an import, matching `check-document-access` and for the same reason: these are browser
 * modules that expect a `document` and Foundry's globals, and a Node guard that has to stand a DOM up
 * before it can count buttons is a guard nobody runs.
 *
 * ⚠️ Its own file rather than living in the CLI, so a test can reach these without importing the
 * command and running the whole check as a side effect of asking what a regex does. `sizes/ratchet.ts`
 * is split from `check-file-sizes.ts` for the same reason.
 */

/** Every `code:` in the key definitions, which is what the bar can send. */
export function barCodesFrom(source: string): Set<string> {
  return new Set([...source.matchAll(/code:\s*'([^']+)'/g)].map((match) => match[1] ?? ''));
}

/**
 * Every tray action `id:`.
 *
 * ⚠️ Anchored to SIX spaces of indent, which is where an action's own `id` sits in the flat list.
 * A looser pattern would sweep in any `id:` appearing anywhere in the file, and a coverage claim
 * satisfied by an id that is not a button is exactly the false pass this guard exists to avoid.
 */
export function trayIdsFrom(source: string): Set<string> {
  return new Set([...source.matchAll(/^ {6}id:\s*'([^']+)'/gm)].map((match) => match[1] ?? ''));
}
