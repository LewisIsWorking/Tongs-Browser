import { MODULE_ID } from '../constants.js';
import type { Logger } from '../core/Logger.js';
import type { BarPosition } from '../modifiers/ModifierBar.js';
import {
  SETTING_DEFINITIONS,
  SettingKey,
  clampToRange,
  findSetting,
  type SettingKeyValue,
} from './SettingDefinitions.js';

/**
 * Minimal view of Foundry's settings API, injected so the store is testable without Foundry.
 *
 * The registration shape is the ambient FoundrySettingRegistration rather than a loose record, so a
 * missing scope or type is a compile error here rather than a silent registration failure at
 * runtime, which is how Foundry reports it.
 */
export interface SettingsBackend {
  register(namespace: string, key: string, data: FoundrySettingRegistration): void;
  get(namespace: string, key: string): unknown;
  /** Foundry returns a promise, but the shape is not depended on beyond awaiting a rejection. */
  set(namespace: string, key: string, value: unknown): unknown;
}

export interface SettingsStoreOptions {
  readonly backend: SettingsBackend;
  readonly logger?: Logger;
  /** Called after any setting changes, so the module can apply it without a reload. */
  readonly onChanged?: (key: SettingKeyValue) => void;
}

/**
 * Typed access to the module's client settings.
 *
 * Foundry's settings API returns unknown, so every read is validated and coerced here rather than
 * cast at the call site. A setting written by an older version of the module, or edited by hand,
 * arrives with the wrong type or out of range, and a cast would push that straight into the gesture
 * config where it becomes a NaN sensitivity or a negative timer.
 */
export class SettingsStore {
  public constructor(private readonly options: SettingsStoreOptions) {}

  public registerAll(): void {
    for (const definition of SETTING_DEFINITIONS) {
      const common = {
        name: definition.name,
        hint: definition.hint,
        // Client scope throughout. A GM on a desktop and a player on a phone want opposite values
        // for nearly all of these.
        scope: 'client',
        config: definition.config,
        default: definition.default,
        onChange: (): void => {
          this.options.onChanged?.(definition.key);
        },
      } as const;

      const data: FoundrySettingRegistration =
        definition.kind === 'number'
          ? { ...common, type: Number, range: definition.range }
          : definition.kind === 'choice'
            ? { ...common, type: String, choices: definition.choices }
            : definition.kind === 'boolean'
              ? { ...common, type: Boolean }
              : { ...common, type: String };

      this.options.backend.register(MODULE_ID, definition.key, data);
    }
  }

  public getBoolean(key: SettingKeyValue): boolean {
    const definition = findSetting(key);
    const fallback = definition?.kind === 'boolean' ? definition.default : false;
    const raw = this.read(key);
    return typeof raw === 'boolean' ? raw : fallback;
  }

  public getNumber(key: SettingKeyValue): number {
    const definition = findSetting(key);
    if (definition?.kind !== 'number') {
      return 0;
    }
    const raw = this.read(key);
    const value = typeof raw === 'number' ? raw : Number(raw);
    return clampToRange(value, definition.range);
  }

  public getChoice(key: SettingKeyValue): string {
    const definition = findSetting(key);
    if (definition?.kind !== 'choice') {
      return '';
    }
    const raw = this.read(key);
    // An unrecognised choice falls back rather than passing through, so a stale value from an older
    // version cannot select a mode that no longer exists.
    return typeof raw === 'string' && raw in definition.choices ? raw : definition.default;
  }

  public getPointerMode(): 'trackpad' | 'offset' {
    return this.getChoice(SettingKey.POINTER_MODE) === 'offset' ? 'offset' : 'trackpad';
  }

  /** Stored as JSON because Foundry client settings hold primitives most reliably. */
  public getBarPosition(): BarPosition | null {
    const raw = this.read(SettingKey.BAR_POSITION);
    if (typeof raw !== 'string' || raw.length === 0) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'x' in parsed &&
        'y' in parsed &&
        typeof (parsed as BarPosition).x === 'number' &&
        typeof (parsed as BarPosition).y === 'number'
      ) {
        return { x: (parsed as BarPosition).x, y: (parsed as BarPosition).y };
      }
    } catch {
      // Corrupt value. Falling back to the default position is better than refusing to start.
      this.options.logger?.warn('Stored modifier bar position was unreadable, using the default.');
    }
    return null;
  }

  public setBarPosition(position: BarPosition): void {
    this.write(SettingKey.BAR_POSITION, JSON.stringify(position));
  }

  public set(key: SettingKeyValue, value: unknown): void {
    this.write(key, value);
  }

  private read(key: SettingKeyValue): unknown {
    try {
      return this.options.backend.get(MODULE_ID, key);
    } catch {
      // Reading before registration throws in Foundry. Treated as absent so start up ordering
      // problems degrade to defaults rather than breaking the module entirely.
      return undefined;
    }
  }

  private write(key: SettingKeyValue, value: unknown): void {
    try {
      const result = this.options.backend.set(MODULE_ID, key, value);
      // Foundry returns a promise here. Ignoring it silently would swallow a failed write, so it is
      // explicitly caught and reported.
      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          this.options.logger?.error(`Failed to persist setting ${key}.`, error);
        });
      }
    } catch (error) {
      this.options.logger?.error(`Failed to persist setting ${key}.`, error);
    }
  }
}
