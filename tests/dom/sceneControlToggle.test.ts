import { describe, expect, it, vi } from 'vitest';

import { MODULE_ID } from '../../src/constants.js';
import { SceneControlToggle } from '../../src/settings/SceneControlToggle.js';

interface Tool {
  name: string;
  active: boolean;
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

  it('adds the tool to the token group in the record shape', () => {
    const controls: Record<string, { tools: Record<string, Tool> }> = {
      token: { tools: {} },
      measure: { tools: {} },
    };
    toggle().inject(controls);

    expect(Object.keys(controls['token']?.tools ?? {})).toEqual([MODULE_ID]);
    expect(Object.keys(controls['measure']?.tools ?? {})).toEqual([]);
  });

  it('falls back to the first group when there is no token group', () => {
    const controls = [{ name: 'unexpected', tools: [] as Tool[] }];
    toggle().inject(controls);

    expect(controls[0]?.tools).toHaveLength(1);
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
