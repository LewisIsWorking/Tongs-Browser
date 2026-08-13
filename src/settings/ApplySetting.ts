import { SettingKey, type SettingKeyValue } from './SettingDefinitions.js';
import type { SettingsStore } from './SettingsStore.js';
import type { TongsBrowser } from '../TongsBrowser.js';

/**
 * Applying a changed setting to the running module. Extracted from main 2026-08-13, when main
 * reached the 200 line limit.
 *
 * ⚠️ The switch is EXHAUSTIVE over `SettingKeyValue` and has no default branch, which is the point of
 * it. Adding a key without deciding what a change to it means becomes a compile error rather than a
 * setting that silently does nothing until somebody notices months later. Two of the cases below do
 * nothing on purpose, and both say why.
 */
export interface ApplySettingTargets {
  readonly instance: TongsBrowser | null;
  readonly store: SettingsStore | null;
}

/**
 * Settings that can be changed in place are, so a player adjusting sensitivity mid session sees it
 * immediately.
 */
export function applySetting(key: SettingKeyValue, targets: ApplySettingTargets): void {
  const { instance, store } = targets;
  if (instance === null || store === null) {
    return;
  }

  switch (key) {
    case SettingKey.ENABLED:
      if (store.getBoolean(SettingKey.ENABLED)) {
        instance.enable();
      } else {
        instance.disable();
      }
      return;

    case SettingKey.POINTER_MODE:
    case SettingKey.SENSITIVITY:
    case SettingKey.OFFSET_DISTANCE:
    case SettingKey.LONG_PRESS_MS:
    case SettingKey.HAPTICS:
      instance.updateGestureConfig(readGestureConfig(store));
      return;

    case SettingKey.CURSOR_SIZE:
      instance.setCursorSize(store.getNumber(SettingKey.CURSOR_SIZE));
      return;

    case SettingKey.UI_SCALE:
      instance.setUiScale(store.getNumber(SettingKey.UI_SCALE));
      return;

    case SettingKey.MODIFIER_BAR_ENABLED:
      instance.setModifierBarVisible(store.getBoolean(SettingKey.MODIFIER_BAR_ENABLED));
      return;

    case SettingKey.DEBUG_OVERLAY:
      instance.setDebugOverlay(store.getBoolean(SettingKey.DEBUG_OVERLAY));
      return;

    case SettingKey.SUPPRESS_NATIVE_TOUCH:
      // Read through a getter on every event, so nothing needs applying here.
      return;

    case SettingKey.BAR_POSITION:
      // Written by the bar itself. Reapplying would fight the drag in progress.
      return;

    case SettingKey.BAR_COLLAPSED:
      /*
       * Also written by the bar itself, when its own `<` button is pressed. Reapplying would be a
       * no-op at best; at worst it would fight a user who is toggling it, since the write and the
       * change hook are the same event going round once more.
       */
      return;
  }
}

/** The gesture settings as one object, read together so the config never mixes two moments. */
export function readGestureConfig(settings: SettingsStore) {
  return {
    pointerMode: settings.getPointerMode(),
    sensitivity: settings.getNumber(SettingKey.SENSITIVITY),
    offsetDistancePx: settings.getNumber(SettingKey.OFFSET_DISTANCE),
    longPressMs: settings.getNumber(SettingKey.LONG_PRESS_MS),
    haptics: settings.getBoolean(SettingKey.HAPTICS),
  };
}
