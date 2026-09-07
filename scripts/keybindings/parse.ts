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

/**
 * The key codes the bar actually RENDERS, which is what a user can press.
 *
 * ⛔ Scoped to the two exported arrays, and that scoping is load bearing. `keyDefinitions.ts` also
 * holds standalone definitions that are never drawn as buttons, `UNDO_KEY` being the first: it is
 * half of a chord, and a bare Z button would be a control that does nothing. A flat sweep for
 * `code:` counted it as reachable, which is the exact false pass this guard exists to prevent, and
 * it appeared the moment the first non-rendered definition was added.
 */
export function barCodesFrom(source: string): Set<string> {
  const rendered = source
    .split('export const ')
    .filter((chunk) => chunk.startsWith('MODIFIER_KEYS') || chunk.startsWith('MOMENTARY_KEYS'))
    .join('\n');

  const codes = new Set(
    [...rendered.matchAll(/code:\s*'([^']+)'/g)].map((match) => match[1] ?? '')
  );

  /*
   * ⚠️ An entry may be a NAME rather than a literal. `CONTROL` was pulled out of `MODIFIER_KEYS` so
   * the undo chord could refer to it without indexing the array, and this parser promptly stopped
   * seeing ControlLeft at all. That is a FALSE NEGATIVE, and it was silent: nothing routes to
   * ControlLeft today, so the guard stayed green while quietly believing the bar had no Ctrl key.
   * A guard that is wrong in the direction of "everything is fine" is the one worth fixing first.
   */
  for (const reference of rendered.matchAll(/^\s*([A-Z][A-Z0-9_]*),\s*$/gm)) {
    const name = reference[1] ?? '';
    const declared = new RegExp(`export const ${name}[^=]*=[\\s\\S]*?code:\\s*'([^']+)'`).exec(
      source
    );
    if (declared?.[1] !== undefined) {
      codes.add(declared[1]);
    }
  }

  return codes;
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
