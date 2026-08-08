import { MODULE_ID } from '../constants.js';

export interface SceneControlToggleOptions {
  readonly isActive: () => boolean;
  readonly onToggle: () => void;
}

/**
 * Shape of the scene control entries Foundry passes to the getSceneControlButtons hook. Kept loose
 * on purpose: the structure has changed between versions, so this describes only what is written.
 */
interface SceneControlTool {
  name: string;
  title: string;
  icon: string;
  toggle: boolean;
  active: boolean;
  visible?: boolean;
  onClick?: () => void;
  onChange?: () => void;
  button?: boolean;
}

interface SceneControl {
  name?: string;
  tools?: SceneControlTool[] | Record<string, SceneControlTool>;
}

/**
 * Adds a one tap on and off switch to the scene controls.
 *
 * The point is reachability rather than convenience. If the pointer misbehaves mid session, opening
 * the settings dialog to disable it means using the pointer to do so, which is exactly the thing
 * that is not working. A scene control button is a single tap that Foundry's own touch handling can
 * deliver without any help from this module.
 */
export class SceneControlToggle {
  private hookId: number | null = null;

  public constructor(private readonly options: SceneControlToggleOptions) {}

  public bind(): void {
    if (this.hookId !== null) {
      return;
    }
    this.hookId = Hooks.on('getSceneControlButtons', (controls: never): void => {
      this.inject(controls);
    });
  }

  public unbind(): void {
    if (this.hookId === null) {
      return;
    }
    Hooks.off('getSceneControlButtons', this.hookId);
    this.hookId = null;
  }

  public isBound(): boolean {
    return this.hookId !== null;
  }

  /**
   * Adds the button to the token control group.
   *
   * Handles both shapes the hook has used: an array of controls in older versions, and a record
   * keyed by name in newer ones. Both `onClick` and `onChange` are set because the callback Foundry
   * invokes for a toggle tool also changed, and setting both is cheaper than detecting which.
   */
  public inject(controls: unknown): void {
    const group = this.findTokenGroup(controls);
    if (group === null) {
      return;
    }

    const tool: SceneControlTool = {
      name: MODULE_ID,
      title: 'Tongs Browser',
      icon: 'fa-solid fa-hand-pointer',
      toggle: true,
      active: this.options.isActive(),
      visible: true,
      onClick: () => {
        this.options.onToggle();
      },
      onChange: () => {
        this.options.onToggle();
      },
    };

    if (Array.isArray(group.tools)) {
      const existing = group.tools.findIndex((candidate) => candidate.name === MODULE_ID);
      if (existing >= 0) {
        group.tools[existing] = tool;
      } else {
        group.tools.push(tool);
      }
      return;
    }

    if (typeof group.tools === 'object') {
      group.tools[MODULE_ID] = tool;
    }
  }

  private findTokenGroup(controls: unknown): SceneControl | null {
    if (Array.isArray(controls)) {
      const found = (controls as SceneControl[]).find((control) => control.name === 'token');
      return found ?? (controls as SceneControl[])[0] ?? null;
    }

    if (typeof controls === 'object' && controls !== null) {
      const record = controls as Record<string, SceneControl>;
      const token = record['token'];
      if (token !== undefined) {
        return token;
      }
      const first = Object.values(record)[0];
      return first ?? null;
    }

    return null;
  }
}
