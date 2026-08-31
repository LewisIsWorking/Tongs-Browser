import '../styles/tongs-browser.css';

import { TongsBrowser } from './TongsBrowser.js';
import { MODULE_ID, MODULE_TITLE } from './constants.js';
import { logger } from './core/Logger.js';
import { ExclusionZones } from './gesture/ExclusionZones.js';
import { buildSuppressor } from './gesture/BuildSuppressor.js';
import { SettingKey } from './settings/SettingDefinitions.js';
import { applySetting, readGestureConfig } from './settings/ApplySetting.js';
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
const exclusions = new ExclusionZones();

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
    // Read when invoked rather than captured, since neither exists yet at init.
    onChanged: (key) => {
      applySetting(key, { instance, store });
    },
  });
  store.registerAll();

  /*
   * ⚠️ Called at INIT, before Foundry builds the canvas, and nothing keeps the result. Both
   * constraints are explained where the code they govern lives: gesture/BuildSuppressor.ts.
   */
  buildSuppressor({
    window,
    enabled: () =>
      (store?.getBoolean(SettingKey.ENABLED) ?? false) &&
      (store?.getBoolean(SettingKey.SUPPRESS_NATIVE_TOUCH) ?? true),
    exclusions,
  });

  /*
   * Bound at init, NOT at ready, and that is load bearing.
   *
   * Foundry builds the scene controls exactly once. Its own scene-controls.mjs says so on
   * #prepareControls: "This is only done once when the application is first rendered. Subsequent
   * renders reuse this data structure." A hook registered at ready has already missed it, and no
   * amount of re-rendering brings it back, so the button simply never existed on Foundry 14.
   *
   * Measured on 14.365 before this change: the hook fired zero times for a listener added at ready,
   * even after ui.controls.render({force: true}).
   *
   * The callbacks read `instance` and `store` when they are invoked rather than capturing them, so
   * binding before either exists is safe. isActive falls back to the stored setting, which is the
   * honest answer while the module is still starting.
   */
  const toggle = new SceneControlToggle({
    isActive: () => instance?.isEnabled() ?? store?.getBoolean(SettingKey.ENABLED) ?? false,
    onToggle: () => {
      /*
       * Writing the setting rather than calling enable directly, so the scene control and the
       * settings dialog cannot disagree about what is on.
       *
       * ⚠️ Falls back to the STORE exactly as `isActive` above does, corrected 2026-08-30. It read
       * `!(instance?.isEnabled() ?? false)`, so the two callbacks disagreed about where the truth
       * lives before `ready` builds the instance: the button reported ON from the store and a tap
       * wrote `true` again, leaving it impossible to switch off. Identical behaviour once `instance`
       * exists, which is why it survived; found by testing the callback rather than the
       * registration.
       */
      store?.set(
        SettingKey.ENABLED,
        !(instance?.isEnabled() ?? store.getBoolean(SettingKey.ENABLED))
      );
    },
  });
  toggle.bind();
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
    eventView: window,
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
    // Unset reads as the definition's default, which is DEFAULT_COLLAPSED, so there is no null case.
    initialBarCollapsed: settings.getBoolean(SettingKey.BAR_COLLAPSED),
    onBarCollapsedChanged: (collapsed) => {
      settings.set(SettingKey.BAR_COLLAPSED, collapsed);
    },
  });

  if (settings.getBoolean(SettingKey.ENABLED)) {
    instance.enable();
  }

  /*
   * Keep the pause button honest when somebody else changes the state.
   *
   * The button refreshes itself when tapped, which covers this client only. It does not cover the GM
   * pausing from a laptop, or another player's request arriving through the relay, and a pause button
   * showing the opposite of the truth invites a tap that does the wrong thing.
   */
  Hooks.on('pauseGame', () => {
    instance?.refreshTray();
  });

  const moduleEntry = game?.modules.get(MODULE_ID);
  if (moduleEntry !== undefined) {
    moduleEntry.api = instance;
  }

  logger.info(`Ready. Keyboard strategy: ${instance.getKeyboardStrategy()}.`);
});
