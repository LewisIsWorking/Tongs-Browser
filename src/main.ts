import '../styles/tongs-browser.css';

import { TongsBrowser } from './TongsBrowser.js';
import { MODULE_ID, MODULE_TITLE } from './constants.js';
import { logger } from './core/Logger.js';
import { SettingKey, type SettingKeyValue } from './settings/SettingDefinitions.js';
import { SceneControlToggle } from './settings/SceneControlToggle.js';
import { SettingsStore } from './settings/SettingsStore.js';

/**
 * Module entry point.
 *
 * Settings are registered at init, which is the hook Foundry requires for it. Everything else waits
 * for ready, because the pointer needs viewport dimensions and the canvas needs to exist, and at
 * init neither is settled.
 */

let instance: TongsBrowser | null = null;
let store: SettingsStore | null = null;

/**
 * Applies one changed setting to the running module.
 *
 * Settings that can be changed in place are, so a player adjusting sensitivity mid session sees it
 * immediately. The two that cannot, because they are read during construction, rebuild the module
 * instead. Rebuilding is heavier but honest: silently ignoring a change the user just made is worse.
 */
function applySetting(key: SettingKeyValue): void {
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
  }
}

function readGestureConfig(settings: SettingsStore) {
  return {
    pointerMode: settings.getPointerMode(),
    sensitivity: settings.getNumber(SettingKey.SENSITIVITY),
    offsetDistancePx: settings.getNumber(SettingKey.OFFSET_DISTANCE),
    longPressMs: settings.getNumber(SettingKey.LONG_PRESS_MS),
    haptics: settings.getBoolean(SettingKey.HAPTICS),
  };
}

Hooks.once('init', () => {
  logger.info(`Initialising ${MODULE_TITLE} (${MODULE_ID}).`);

  const settingsApi = game?.settings;
  if (settingsApi === undefined) {
    logger.error('Foundry settings API unavailable, cannot register settings.');
    return;
  }

  store = new SettingsStore({
    backend: settingsApi,
    logger,
    onChanged: applySetting,
  });
  store.registerAll();
});

Hooks.once('ready', () => {
  if (store === null) {
    logger.error('Settings were not registered, module will not start.');
    return;
  }

  const settings = store;
  const barPosition = settings.getBarPosition();

  instance = new TongsBrowser({
    document,
    window,
    gestureConfig: readGestureConfig(settings),
    cursorSize: settings.getNumber(SettingKey.CURSOR_SIZE),
    uiScale: settings.getNumber(SettingKey.UI_SCALE),
    modifierBarEnabled: settings.getBoolean(SettingKey.MODIFIER_BAR_ENABLED),
    debugOverlay: settings.getBoolean(SettingKey.DEBUG_OVERLAY),
    // Read through a getter rather than captured, so toggling it takes effect on the next event
    // instead of needing a reload.
    suppressNativeTouch: () => settings.getBoolean(SettingKey.SUPPRESS_NATIVE_TOUCH),
    ...(barPosition === null ? {} : { initialBarPosition: barPosition }),
    onBarPositionChanged: (position) => {
      settings.setBarPosition(position);
    },
  });

  const toggle = new SceneControlToggle({
    isActive: () => instance?.isEnabled() ?? false,
    onToggle: () => {
      // Writing the setting rather than calling enable directly, so the scene control and the
      // settings dialog cannot disagree about what is on.
      settings.set(SettingKey.ENABLED, !(instance?.isEnabled() ?? false));
    },
  });
  toggle.bind();

  if (settings.getBoolean(SettingKey.ENABLED)) {
    instance.enable();
  }

  const moduleEntry = game?.modules.get(MODULE_ID);
  if (moduleEntry !== undefined) {
    moduleEntry.api = instance;
  }

  logger.info(`Ready. Keyboard strategy: ${instance.getKeyboardStrategy()}.`);
});
