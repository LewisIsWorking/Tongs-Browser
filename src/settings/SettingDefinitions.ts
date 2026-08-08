/**
 * Every setting, in one place, described once.
 *
 * The definitions carry their own type, range and default, so registration, reading and clamping all
 * derive from this rather than repeating the numbers. A default that disagrees between the register
 * call and the read path is the classic settings bug, and there is only one copy here to disagree
 * with.
 *
 * All of them are client scoped. Each player configures their own device: the GM on a desktop and a
 * player on a phone want opposite values for nearly every one of these, and a world scoped setting
 * would force them to share.
 */

export const SettingKey = {
  ENABLED: 'enabled',
  POINTER_MODE: 'pointerMode',
  SENSITIVITY: 'sensitivity',
  CURSOR_SIZE: 'cursorSize',
  OFFSET_DISTANCE: 'offsetDistance',
  LONG_PRESS_MS: 'longPressMs',
  HAPTICS: 'haptics',
  SUPPRESS_NATIVE_TOUCH: 'suppressNativeTouch',
  MODIFIER_BAR_ENABLED: 'modifierBarEnabled',
  UI_SCALE: 'uiScale',
  DEBUG_OVERLAY: 'debugOverlay',
  /** Not shown in the settings form. Persisted so the bar reopens where it was left. */
  BAR_POSITION: 'barPosition',
} as const;

export type SettingKeyValue = (typeof SettingKey)[keyof typeof SettingKey];

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

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = Object.freeze([
  {
    key: SettingKey.ENABLED,
    kind: 'boolean',
    name: 'Enabled',
    hint: 'Turn the virtual pointer, modifier bar and interface scaling on or off.',
    config: true,
    default: true,
  },
  {
    key: SettingKey.POINTER_MODE,
    kind: 'choice',
    name: 'Pointer mode',
    hint: 'Trackpad moves the pointer by a relative amount and suits a phone. Offset places the pointer above your finger and suits a tablet.',
    config: true,
    default: 'trackpad',
    choices: { trackpad: 'Trackpad (relative)', offset: 'Offset (above finger)' },
  },
  {
    key: SettingKey.SENSITIVITY,
    kind: 'number',
    name: 'Sensitivity',
    hint: 'How far the pointer travels for a given finger movement, in trackpad mode.',
    config: true,
    default: 1.5,
    range: { min: 0.5, max: 3, step: 0.1 },
  },
  {
    key: SettingKey.CURSOR_SIZE,
    kind: 'number',
    name: 'Cursor size',
    hint: 'Diameter of the pointer, in pixels.',
    config: true,
    default: 28,
    range: { min: 16, max: 48, step: 1 },
  },
  {
    key: SettingKey.OFFSET_DISTANCE,
    kind: 'number',
    name: 'Offset distance',
    hint: 'How far above your finger the pointer sits. Only used in offset mode.',
    config: true,
    default: 60,
    range: { min: 0, max: 120, step: 5 },
  },
  {
    key: SettingKey.LONG_PRESS_MS,
    kind: 'number',
    name: 'Long press duration',
    hint: 'How long to hold before a long press becomes a right click, in milliseconds.',
    config: true,
    default: 500,
    range: { min: 300, max: 1000, step: 50 },
  },
  {
    key: SettingKey.HAPTICS,
    kind: 'boolean',
    name: 'Haptic feedback',
    hint: 'Vibrate briefly on a long press. Ignored on devices without a vibrator, including iOS.',
    config: true,
    default: true,
  },
  {
    key: SettingKey.SUPPRESS_NATIVE_TOUCH,
    kind: 'boolean',
    name: 'Suppress native touch events',
    hint: 'Stop the browser sending its own touch derived pointer events to Foundry. Turn this off if another touch module such as TouchVTT is also installed and you want it to handle input.',
    config: true,
    default: true,
  },
  {
    key: SettingKey.MODIFIER_BAR_ENABLED,
    kind: 'boolean',
    name: 'Show modifier bar',
    hint: 'Show the floating Ctrl, Shift, Alt and special key bar.',
    config: true,
    default: true,
  },
  {
    key: SettingKey.UI_SCALE,
    kind: 'number',
    name: 'Interface scale',
    hint: 'Shrink the Foundry interface so more of it fits on screen. Does not affect the map.',
    config: true,
    default: 0.75,
    range: { min: 0.5, max: 1, step: 0.05 },
  },
  {
    key: SettingKey.DEBUG_OVERLAY,
    kind: 'boolean',
    name: 'Debug overlay',
    hint: 'Outline the element under the pointer and log every synthesised event to the console.',
    config: true,
    default: false,
  },
  {
    key: SettingKey.BAR_POSITION,
    kind: 'json',
    name: 'Modifier bar position',
    hint: 'Remembered automatically.',
    config: false,
    default: '',
  },
]);

export function findSetting(key: SettingKeyValue): SettingDefinition | undefined {
  return SETTING_DEFINITIONS.find((definition) => definition.key === key);
}

/**
 * Constrains a number to its declared range and snaps it to the step.
 *
 * Applied on read as well as on write, because a value can reach the store from an older version of
 * the module with a different range, or from a user editing the settings JSON by hand.
 */
export function clampToRange(value: number, range: NumberRange): number {
  if (!Number.isFinite(value)) {
    return range.min;
  }
  const clamped = Math.min(Math.max(value, range.min), range.max);
  const stepped = Math.round((clamped - range.min) / range.step) * range.step + range.min;
  // Rounded to three places so binary floating point noise never reaches the store or the slider.
  return Math.round(stepped * 1000) / 1000;
}
