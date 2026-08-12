import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModifierBar } from '../../src/modifiers/ModifierBar.js';
import { startRecording, synthesizer } from './support/keyboardRecording.js';

/**
 * Telling the diagnostics timeline WHICH tray button was tapped.
 *
 * ⚠️ The whole point is the id. A parameterless notification would satisfy "the bar reports taps"
 * and still leave the report saying "a button was pressed", which is what four device round trips
 * were spent not knowing. The user found "the hand button breaks the drag" by experiment because
 * nothing in the module could say it.
 */
beforeEach(() => {
  startRecording();
});

const barWith = (onTrayActivated?: (actionId: string) => void) => {
  const bar = new ModifierBar({
    document,
    synthesizer: synthesizer(null),
    onFlagsChanged: () => undefined,
    trayActions: [
      { id: 'grab', label: '✋', title: 'Grab', activate: () => undefined },
      { id: 'sidebar', label: '☰', title: 'Sidebar', activate: () => undefined },
    ],
    ...(onTrayActivated === undefined ? {} : { onTrayActivated }),
  });
  bar.attach();
  return bar;
};

const tap = (bar: ModifierBar, id: string) => {
  bar.getElement().querySelector<HTMLButtonElement>(`[data-action="${id}"]`)?.click();
};

describe('reporting tray taps', () => {
  it('names the button that was tapped, not merely that one was', () => {
    const reported = vi.fn();

    tap(barWith(reported), 'grab');

    expect(reported).toHaveBeenCalledWith('grab');
  });

  it('distinguishes one button from another', () => {
    const reported = vi.fn();
    const bar = barWith(reported);

    tap(bar, 'sidebar');
    tap(bar, 'grab');

    expect(reported.mock.calls.map((call) => String(call[0]))).toEqual(['sidebar', 'grab']);
  });

  /**
   * ⚠️ Reporting must not become a dependency. If the bar only worked when someone was listening,
   * the module under test would differ from the module shipped, which is the failure mode a
   * diagnostic is least able to detect in itself.
   */
  it('works exactly the same with nobody listening', () => {
    const activate = vi.fn();
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      trayActions: [{ id: 'grab', label: '✋', title: 'Grab', activate }],
    });
    bar.attach();

    expect(() => {
      tap(bar, 'grab');
    }).not.toThrow();
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('still runs the action itself, which the reporting must never displace', () => {
    const activate = vi.fn();
    const reported = vi.fn();
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      trayActions: [{ id: 'grab', label: '✋', title: 'Grab', activate }],
      onTrayActivated: reported,
    });
    bar.attach();

    tap(bar, 'grab');

    expect(activate).toHaveBeenCalledTimes(1);
    expect(reported).toHaveBeenCalledWith('grab');
  });
});
