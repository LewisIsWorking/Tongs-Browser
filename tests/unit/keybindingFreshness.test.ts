import { describe, expect, it } from 'vitest';

import { compareToLive, describeVersions } from '../../scripts/keybindings/freshness.ts';

/**
 * Whether the keybinding snapshot still describes the installed Foundry. Written 2026-09-10.
 *
 * ⛔ WHY THE CHECK EXISTS AT ALL. `check-keybinding-coverage` compares our routing table against our
 * snapshot. Both are ours, so the strongest thing it can prove is that we agree with ourselves. It
 * printed "OK: all 37 core keybinding(s) from Foundry 14.366 are accounted for" on a machine running
 * 14.367, where four bindings were unrouted and `KeyE` had moved from `moveDownRight` to a new
 * `ascend`. Nothing in that sentence was false and nothing in it was useful.
 *
 * ⚠️ These tests are the half that can run without a Foundry, which is the half that decides whether
 * the live check is telling the truth when it does run.
 */
const binding = (name: string, ...keys: string[]) => ({ name, keys });

describe('a snapshot that still matches', () => {
  it('reports nothing when the two agree', () => {
    const same = [binding('pause', 'Space'), binding('target', 'KeyT')];

    expect(compareToLive(same, same)).toEqual([]);
  });

  /** ⚠️ Order is not drift. Foundry's registration order is not the snapshot's reading order. */
  it('does not care what order the bindings arrive in', () => {
    const snapshot = [binding('pause', 'Space'), binding('target', 'KeyT')];
    const live = [binding('target', 'KeyT'), binding('pause', 'Space')];

    expect(compareToLive(snapshot, live)).toEqual([]);
  });
});

describe('a snapshot that has gone stale', () => {
  it('names a binding Foundry has that the snapshot does not', () => {
    const problems = compareToLive(
      [binding('pause', 'Space')],
      [binding('pause', 'Space'), binding('ascend', 'KeyE')]
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]?.binding).toBe('ascend');
    expect(problems[0]?.reason).toContain('NOT in the snapshot');
  });

  it('names a binding the snapshot has that Foundry no longer registers', () => {
    const problems = compareToLive(
      [binding('pause', 'Space'), binding('retired', 'KeyR')],
      [binding('pause', 'Space')]
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]?.binding).toBe('retired');
  });

  /**
   * ⛔ THE SILENT ONE, and the reason this is not merely a name diff. Between 14.366 and 14.367
   * `moveDownRight` lost KeyE and the new `ascend` took it. Every name still present, every count
   * still plausible, and a routing decision that keeps reading sensibly while pointing at a
   * different capability. A key that changes hands is worse than one that disappears.
   */
  it('catches a key that changed hands, with both names still present', () => {
    const snapshot = [binding('moveDownRight', 'KeyE'), binding('descend', 'KeyQ')];
    const live = [binding('moveDownRight'), binding('descend', 'KeyQ'), binding('ascend', 'KeyE')];

    const problems = compareToLive(snapshot, live);

    expect(problems.map((problem) => problem.binding).sort()).toEqual(['ascend', 'moveDownRight']);
    expect(problems.find((problem) => problem.binding === 'moveDownRight')?.reason).toContain(
      'has moved'
    );
  });

  /** ⚠️ Modifiers are part of the binding: Ctrl+C and plain C are not the same thing. */
  it('treats a modifier change as a move', () => {
    const problems = compareToLive([binding('copy', 'CONTROL+KeyC')], [binding('copy', 'KeyC')]);

    expect(problems).toHaveLength(1);
    expect(problems[0]?.reason).toContain('has moved');
  });

  it('says "(unbound)" rather than nothing when a binding loses its key', () => {
    const problems = compareToLive([binding('moveDownRight', 'KeyE')], [binding('moveDownRight')]);

    expect(problems[0]?.reason).toContain('(unbound)');
  });
});

describe('the families Foundry registers in a loop', () => {
  /**
   * ⛔ WITHOUT THIS, THE CHECK FAILS FOREVER. Foundry registers executeMacro0..9 and
   * swapMacroPage1..5: fifteen actions for two capabilities. The snapshot holds the base name once,
   * deliberately. On its first real run this check reported all fifteen as new, which buried the one
   * genuine finding underneath them, and a check that always fails is a check nobody reads.
   */
  it('collapses numbered members onto the base name the snapshot records', () => {
    const snapshot = [
      binding('executeMacro', 'Digit1'),
      binding('swapMacroPage', 'CONTROL+Digit1'),
    ];
    const live = [
      binding('executeMacro0', 'Digit0'),
      binding('executeMacro1', 'Digit1'),
      binding('executeMacro9', 'Digit9'),
      binding('swapMacroPage1', 'CONTROL+Digit1'),
      binding('swapMacroPage5', 'CONTROL+Digit5'),
    ];

    expect(compareToLive(snapshot, live)).toEqual([]);
  });

  /**
   * ⚠️ Presence only, never keys. The members do not share a key, so any key the snapshot records
   * for the family is one member's, and asserting it would report a move on every run.
   */
  it('does not compare a family key, since its members do not share one', () => {
    const problems = compareToLive(
      [binding('executeMacro', 'Digit1')],
      [binding('executeMacro7', 'Digit7')]
    );

    expect(problems).toEqual([]);
  });

  /**
   * ⛔ The families are named explicitly rather than matched by stripping trailing digits, so a
   * genuinely new binding that happens to end in a number cannot be swallowed by the rule.
   */
  it('does not swallow an unrelated binding that ends in a digit', () => {
    const problems = compareToLive(
      [binding('pause', 'Space')],
      [binding('pause', 'Space'), binding('move2', 'KeyM')]
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]?.binding).toBe('move2');
  });

  /** ⚠️ A family that vanishes entirely must still be reported. */
  it('reports a family that Foundry has stopped registering', () => {
    const problems = compareToLive(
      [binding('executeMacro', 'Digit1')],
      [binding('pause', 'Space')]
    );

    expect(problems.map((problem) => problem.binding)).toContain('executeMacro');
  });
});

describe('how the versions are reported', () => {
  it('says so plainly when they match', () => {
    expect(describeVersions('14.367', '14.367')).toContain('both 14.367');
  });

  it('names both when they differ', () => {
    const said = describeVersions('14.366', '14.367');

    expect(said).toContain('14.366');
    expect(said).toContain('14.367');
  });

  /**
   * ⚠️ A matching version is NOT evidence the bindings match, which is why the caller compares them
   * regardless. A patch release can move a key without the number this module reads changing.
   */
  it('is a description rather than a verdict', () => {
    expect(typeof describeVersions('14.367', '14.367')).toBe('string');
  });
});
