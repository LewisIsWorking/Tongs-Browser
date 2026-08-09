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
  /** Foundry 14 sorts tools by this. Without it the button lands in an arbitrary position. */
  order?: number;
  onClick?: () => void;
  onChange?: () => void;
  button?: boolean;
}

interface SceneControl {
  name?: string;
  tools?: SceneControlTool[] | Record<string, SceneControlTool>;
}

/**
 * Names the token control group has gone by, newest first.
 *
 * Foundry 14 calls it `tokens`. Its own documented example for this hook writes to
 * `controls.tokens.tools.myTool`, and `ui.controls.controls` on a live 14.365 has the keys
 * regions, drawings, tiles, walls, tokens, sounds, lighting, notes. Older versions used the
 * singular, which is kept so this does not break if the module is run against one.
 */
const TOKEN_GROUP_NAMES: readonly string[] = ['tokens', 'token'];

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

    const existingCount = Array.isArray(group.tools)
      ? group.tools.length
      : Object.keys(group.tools ?? {}).length;

    const tool: SceneControlTool = {
      name: MODULE_ID,
      title: 'Tongs Browser',
      icon: 'fa-solid fa-hand-pointer',
      toggle: true,
      active: this.options.isActive(),
      visible: true,
      // Appended rather than interleaved with Foundry's own tools, which is what its documented
      // example does. Without an order the button lands wherever the sort happens to put it.
      order: existingCount,
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

    /*
     * Created when absent rather than skipped. Foundry's own #prepareControls does `control.tools
     * ??= {}` AFTER calling this hook, so a group with no tools of its own arrives here with tools
     * undefined. The previous `typeof group.tools === 'object'` test failed on undefined and
     * silently wrote nothing, which is the same invisible outcome as not being called at all.
     */
    group.tools ??= {};
    if (!Array.isArray(group.tools)) {
      group.tools[MODULE_ID] = tool;
    }
  }

  /**
   * Finds the token control group, and returns null rather than guessing.
   *
   * ⚠️ There used to be a fallback here that took the FIRST group when no token group was found,
   * and it was actively harmful. On Foundry 14 the group is called `tokens`, this looked for
   * `token`, and the fallback therefore put the button silently into `regions`. Measured on 14.365,
   * the group keys are regions, drawings, tiles, walls, tokens, sounds, lighting, notes, so the
   * first group is the one furthest from where a user would look.
   *
   * A button in the wrong toolbar is worse than no button, because this is the escape hatch for
   * when the pointer is misbehaving: someone hunting for it needs it where it was documented to be,
   * not somewhere plausible. Returning null makes a future rename a visible absence rather than a
   * silent relocation.
   */
  private findTokenGroup(controls: unknown): SceneControl | null {
    if (Array.isArray(controls)) {
      const groups = controls as SceneControl[];
      for (const name of TOKEN_GROUP_NAMES) {
        const found = groups.find((control) => control.name === name);
        if (found !== undefined) {
          return found;
        }
      }
      return null;
    }

    if (typeof controls === 'object' && controls !== null) {
      const record = controls as Record<string, SceneControl>;
      for (const name of TOKEN_GROUP_NAMES) {
        const found = record[name];
        if (found !== undefined) {
          return found;
        }
      }
      return null;
    }

    return null;
  }
}
