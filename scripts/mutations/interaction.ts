import type { RecordedMutation } from './shape.ts';

/**
 * Defects on the INPUT and DIAGNOSTICS path: what the bar sends, in what order, and where a notice
 * goes. Split from `recorded.ts` 2026-09-08 when it crossed the size limit.
 *
 * ⚠️ They share a shape too: every one of them leaves the call COUNTS identical and changes only
 * the order or the receiver, so no coverage figure moves and only an ordered assertion sees them.
 */
export const INTERACTION_MUTATIONS: readonly RecordedMutation[] = [
  {
    file: 'src/modifiers/KeyButtons.ts',
    find: '      this.options.synthesizer.tap(definition);\n      this.consumeLatched();',
    replace: '      this.consumeLatched();\n      this.options.synthesizer.tap(definition);',
    /*
     * ⚠️ Swapping two adjacent lines, both of which still run, which is why no count and no coverage
     * figure moves. It drops every latched modifier BEFORE the key it was latched for goes out, so
     * every combination the bar exists to make reachable silently becomes the bare key: Ctrl+Delete
     * becomes Delete, and Shift+T stops adding a target and starts replacing every other one.
     *
     * ⛔ Recorded because ORDER is the property and order is the thing a test forgets to assert. The
     * first version of the target test kept `tapped` and `released` in separate arrays and checked
     * the contents of each, which passes both ways round.
     */
    defect:
      'latched modifiers are released BEFORE the key they modify, so every combination sends the bare key',
    tests: ['tests/dom/targetKey.test.ts'],
  },
  {
    file: 'src/modifiers/Chord.ts',
    find: '  for (const modifier of modifiers) {\n    ports.press(modifier);\n  }\n\n  ports.tap(key);',
    replace:
      '  ports.tap(key);\n\n  for (const modifier of modifiers) {\n    ports.press(modifier);\n  }',
    /*
     * ⚠️ The same defect as the one above, in the module written to avoid it. Every call still
     * happens and the counts are identical, so only an ORDERED assertion sees it. The key goes out
     * before the modifier is down, so Ctrl+Z becomes a bare Z: Foundry binds no plain Z, and the
     * undo button silently does nothing at all rather than failing.
     */
    defect: 'a chord taps its key before holding the modifier, so Ctrl+Z is sent as a bare Z',
    tests: ['tests/unit/chord.test.ts'],
  },
  {
    file: 'src/debug/ChatTargets.ts',
    find: '    notify: notifications?.info?.bind(notifications),',
    replace: '    notify: notifications?.info,',
    /*
     * ⚠️ Deleting one `.bind`, which reads as tidying. Foundry's `info` delegates through
     * `this.notify`, so detached it re-enters itself off the very literal it is returned in, and the
     * result is `RangeError: Maximum call stack size exceeded` with a stack containing not one frame
     * of this module. Losing `this` normally throws at once; here the accidental receiver carried a
     * property of exactly the right name, so an ordinary mistake became infinite recursion.
     *
     * ⛔ Recorded because the OLD test could not see it. It stubbed `notify` as a plain function,
     * which never delegates and so never recurses. Only a fake with Foundry's real shape catches it,
     * and it took the first world with parties in it to reach the line at all.
     */
    defect: 'the notify port is handed out detached, so a notice recurses until the stack runs out',
    tests: ['tests/unit/chatTargetsBinding.test.ts'],
  },
];
