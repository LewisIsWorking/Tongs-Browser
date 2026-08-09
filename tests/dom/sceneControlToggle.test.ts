import { describe, expect, it, vi } from 'vitest';

import { MODULE_ID } from '../../src/constants.js';
import { SceneControlToggle } from '../../src/settings/SceneControlToggle.js';

interface Tool {
  name: string;
  active: boolean;
  order?: number;
  onClick?: () => void;
  onChange?: () => void;
}

function toggle(options: { active?: boolean; onToggle?: () => void } = {}): SceneControlToggle {
  return new SceneControlToggle({
    isActive: () => options.active ?? true,
    onToggle:
      options.onToggle ??
      ((): void => {
        // No op default for tests that do not care about the callback.
      }),
  });
}

/**
 * The point of this button is reachability. If the pointer misbehaves mid session, opening the
 * settings dialog to switch it off means using the pointer to do so, which is the thing that is not
 * working. A scene control is one tap that Foundry's own touch handling delivers unaided.
 *
 * The hook payload shape has changed between Foundry versions, from an array of controls to a record
 * keyed by name, so both are handled and both are tested.
 */
describe('SceneControlToggle injection', () => {
  it('adds the tool to the token group in the array shape', () => {
    const controls = [
      { name: 'token', tools: [] as Tool[] },
      { name: 'measure', tools: [] as Tool[] },
    ];
    toggle().inject(controls);

    expect(controls[0]?.tools.map((tool) => tool.name)).toEqual([MODULE_ID]);
    expect(controls[1]?.tools).toEqual([]);
  });

  /**
   * Foundry 14 calls the group `tokens`. Verified against a live 14.365, whose group keys are
   * regions, drawings, tiles, walls, tokens, sounds, lighting, notes, and whose own documented hook
   * example writes to controls.tokens.tools.
   */
  it('adds the tool to the tokens group Foundry 14 actually uses', () => {
    const controls: Record<string, { tools: Record<string, Tool> }> = {
      regions: { tools: {} },
      tokens: { tools: {} },
    };
    toggle().inject(controls);

    expect(Object.keys(controls['tokens']?.tools ?? {})).toEqual([MODULE_ID]);
    expect(Object.keys(controls['regions']?.tools ?? {})).toEqual([]);
  });

  it('still finds the singular token group older versions used', () => {
    const controls: Record<string, { tools: Record<string, Tool> }> = {
      token: { tools: {} },
      measure: { tools: {} },
    };
    toggle().inject(controls);

    expect(Object.keys(controls['token']?.tools ?? {})).toEqual([MODULE_ID]);
    expect(Object.keys(controls['measure']?.tools ?? {})).toEqual([]);
  });

  /**
   * There used to be a fallback here that took the first group, and it was actively harmful.
   *
   * On Foundry 14 the group is `tokens`, the lookup was for `token`, and the fallback therefore put
   * the button silently into `regions`, the first key in the record. A button in the wrong toolbar
   * is worse than no button: this is the escape hatch for when the pointer is misbehaving, so
   * someone hunting for it needs it where it is documented to be. An absence is diagnosable, a
   * silent relocation is not.
   */
  it('injects nowhere at all rather than guessing when no token group exists', () => {
    const array = [{ name: 'unexpected', tools: [] as Tool[] }];
    toggle().inject(array);
    expect(array[0]?.tools).toHaveLength(0);

    const record: Record<string, { tools: Record<string, Tool> }> = {
      regions: { tools: {} },
      drawings: { tools: {} },
    };
    toggle().inject(record);
    expect(Object.keys(record['regions']?.tools ?? {})).toEqual([]);
    expect(Object.keys(record['drawings']?.tools ?? {})).toEqual([]);
  });

  /**
   * Foundry's own #prepareControls does `control.tools ??= {}` AFTER calling this hook, so a group
   * that defines no tools of its own arrives with tools undefined. The previous code tested
   * `typeof group.tools === 'object'`, which is false for undefined, and wrote nothing at all.
   */
  it('creates the tools collection when the group arrives without one', () => {
    const controls: Record<string, { tools?: Record<string, Tool> }> = { tokens: {} };
    toggle().inject(controls);

    expect(Object.keys(controls['tokens']?.tools ?? {})).toEqual([MODULE_ID]);
  });

  it('orders itself after the tools already in the group', () => {
    const controls: Record<string, { tools: Record<string, Tool> }> = {
      tokens: {
        tools: {
          select: { name: 'select', active: true },
          target: { name: 'target', active: false },
        },
      },
    };
    toggle().inject(controls);

    expect(controls['tokens']?.tools[MODULE_ID]?.order).toBe(2);
  });

  it('reflects the current enabled state on the button', () => {
    const controls = [{ name: 'token', tools: [] as Tool[] }];
    toggle({ active: false }).inject(controls);

    expect(controls[0]?.tools[0]?.active).toBe(false);
  });

  /**
   * Foundry re-runs this hook on every controls render, so injecting blindly would stack duplicate
   * buttons until the toolbar overflowed.
   */
  it('replaces its own tool rather than adding a second one on re-render', () => {
    const controls = [{ name: 'token', tools: [] as Tool[] }];
    const subject = toggle();

    subject.inject(controls);
    subject.inject(controls);
    subject.inject(controls);

    expect(controls[0]?.tools).toHaveLength(1);
  });

  it('leaves other tools in the group alone', () => {
    const controls = [{ name: 'token', tools: [{ name: 'select', active: true }] as Tool[] }];
    toggle().inject(controls);

    expect(controls[0]?.tools.map((tool) => tool.name)).toEqual(['select', MODULE_ID]);
  });

  /**
   * Which callback Foundry invokes for a toggle tool changed between versions, so both are set.
   * Setting both is cheaper and more robust than detecting the version.
   */
  it.each(['onClick', 'onChange'] as const)('fires the toggle through %s', (handler) => {
    const onToggle = vi.fn();
    const controls = [{ name: 'token', tools: [] as Tool[] }];
    toggle({ onToggle }).inject(controls);

    controls[0]?.tools[0]?.[handler]?.();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it.each([null, undefined, 42, 'nonsense'])(
    'ignores an unusable controls payload of %s rather than throwing',
    (controls) => {
      expect(() => {
        toggle().inject(controls);
      }).not.toThrow();
    }
  );

  it('ignores an empty controls collection', () => {
    expect(() => {
      toggle().inject([]);
    }).not.toThrow();
    expect(() => {
      toggle().inject({});
    }).not.toThrow();
  });
});
