import type { SettingKeyValue } from './SettingDefinitions.js';

/**
 * What a setting can BE, as opposed to which settings exist. Extracted from SettingDefinitions
 * 2026-08-13, when that file reached 212 lines against a hard 200 limit.
 *
 * The split is by rate of change rather than by size: these four shapes have not changed since the
 * settings were written, while the list beside them grows every time the module gains a feature.
 *
 * ⚠️ The import above is TYPE ONLY, and has to stay that way. `SettingDefinitions` imports the shapes
 * back, so a value import here would be a genuine runtime cycle with the definitions array evaluating
 * against a half initialised module. A type import is erased entirely.
 */
export interface NumberRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

interface BaseDefinition {
  readonly key: SettingKeyValue;
  readonly name: string;
  readonly hint: string;
  /** False keeps it out of the settings form, for values persisted but not user editable. */
  readonly config: boolean;
}

export interface BooleanSetting extends BaseDefinition {
  readonly kind: 'boolean';
  readonly default: boolean;
}

export interface NumberSetting extends BaseDefinition {
  readonly kind: 'number';
  readonly default: number;
  readonly range: NumberRange;
}

export interface ChoiceSetting extends BaseDefinition {
  readonly kind: 'choice';
  readonly default: string;
  readonly choices: Readonly<Record<string, string>>;
}

export interface JsonSetting extends BaseDefinition {
  readonly kind: 'json';
  readonly default: string;
}

export type SettingDefinition = BooleanSetting | NumberSetting | ChoiceSetting | JsonSetting;
