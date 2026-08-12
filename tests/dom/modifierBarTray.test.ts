import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModifierBar } from '../../src/modifiers/ModifierBar.js';
import { startRecording, synthesizer } from './support/keyboardRecording.js';

beforeEach(() => {
  startRecording();
});

describe('ModifierBar tray actions', () => {
  function barWithAction(activate: () => void): ModifierBar {
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      trayActions: [
        { id: 'sidebar', label: '☰', title: 'Show or hide the Foundry sidebar', activate },
      ],
    });
    bar.attach();
    return bar;
  }

  it('renders a button for each tray action', () => {
    const bar = barWithAction(() => undefined);
    const button = bar.getElement().querySelector('[data-action="sidebar"]');

    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe('Show or hide the Foundry sidebar');
  });

  it('activates the action when tapped', () => {
    const activate = vi.fn();
    const bar = barWithAction(activate);

    bar.getElement().querySelector<HTMLButtonElement>('[data-action="sidebar"]')?.click();

    expect(activate).toHaveBeenCalledOnce();
  });

  /**
   * The reason it lives outside the keys container. Collapsing hides the modifier keys, which is the
   * point of collapsing, but "show me the sidebar" is most needed exactly when the bar has been
   * shrunk out of the way.
   */
  it('stays visible when the bar is collapsed', () => {
    const bar = barWithAction(() => undefined);
    bar.setCollapsed(true);

    const button = bar.getElement().querySelector<HTMLElement>('[data-action="sidebar"]');
    const keys = bar.getElement().querySelector<HTMLElement>('.tb-modifier-bar__keys');

    expect(keys?.style.display).toBe('none');
    expect(button?.closest('.tb-modifier-bar__keys')).toBeNull();
    expect(button?.style.display).not.toBe('none');
  });

  /**
   * A stateful button has to show its state, or a second tap undoes the first by accident. Pause and
   * grab are both toggles whose "on" is invisible without this.
   */
  it('marks a stateful action as on, and updates when the state changes', () => {
    let paused = false;
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      trayActions: [
        {
          id: 'pause',
          label: '⏸',
          title: 'Pause',
          activate: () => undefined,
          isActive: () => paused,
        },
      ],
    });
    bar.attach();
    const button = bar.getElement().querySelector<HTMLElement>('[data-action="pause"]');

    expect(button?.classList.contains('tb-modifier-bar__action--on')).toBe(false);
    expect(button?.getAttribute('aria-pressed')).toBe('false');

    paused = true;
    bar.refreshActions();

    expect(button?.classList.contains('tb-modifier-bar__action--on')).toBe(true);
    expect(button?.getAttribute('aria-pressed')).toBe('true');
  });

  /**
   * A held grab has to SAY it wants letting go.
   *
   * Named for the requirement rather than for getLabel, because the requirement is what must not
   * regress: the latched colour is not enough on its own. A device report on 2026-08-11 came back
   * with a drag still held and a token that had not moved, which read as a broken drag and was
   * Foundry correctly declining to commit a move that had never been dropped. Everything else in
   * that gesture measured perfectly against a live 14.365.
   */
  it('tells a held grab to be let go, rather than only colouring it', () => {
    let held = false;
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      trayActions: [
        {
          id: 'grab',
          label: '✋',
          getLabel: () => (held ? 'DROP' : '✋'),
          title: 'Grab',
          activate: () => {
            held = !held;
          },
          isActive: () => held,
        },
      ],
    });
    bar.attach();
    const button = bar.getElement().querySelector<HTMLButtonElement>('[data-action="grab"]');

    expect(button?.textContent).toBe('✋');

    button?.click();

    expect(held).toBe(true);
    expect(button?.textContent).toBe('DROP');

    button?.click();

    expect(button?.textContent).toBe('✋');
  });

  /** Tapping refreshes immediately, so the button is never a tap behind what it controls. */
  it('refreshes its own state as soon as it is tapped', () => {
    let held = false;
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      trayActions: [
        {
          id: 'grab',
          label: '✋',
          title: 'Grab',
          activate: () => {
            held = !held;
          },
          isActive: () => held,
        },
      ],
    });
    bar.attach();
    const button = bar.getElement().querySelector<HTMLButtonElement>('[data-action="grab"]');

    button?.click();

    expect(button?.classList.contains('tb-modifier-bar__action--on')).toBe(true);
  });

  it('clusters grouped actions together rather than leaving them in the main flow', () => {
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
      trayActions: [
        { id: 'pan-up', label: '↑', title: 'Up', activate: () => undefined, group: 'pan' },
        { id: 'pan-down', label: '↓', title: 'Down', activate: () => undefined, group: 'pan' },
        { id: 'loose', label: 'X', title: 'Loose', activate: () => undefined },
      ],
    });
    bar.attach();

    const group = bar.getElement().querySelector('.tb-modifier-bar__group--pan');
    expect(group?.querySelectorAll('.tb-modifier-bar__action')).toHaveLength(2);
    expect(
      bar.getElement().querySelector('[data-action="loose"]')?.closest('.tb-modifier-bar__group')
    ).toBeNull();
  });

  it('renders no action buttons when none are supplied', () => {
    const bar = new ModifierBar({
      document,
      synthesizer: synthesizer(null),
      onFlagsChanged: () => undefined,
    });
    bar.attach();

    expect(bar.getElement().querySelectorAll('.tb-modifier-bar__action')).toHaveLength(0);
  });
});
