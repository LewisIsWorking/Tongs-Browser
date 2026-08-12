#!/usr/bin/env node
import type { Page } from 'playwright';
/**
 * Measures how a real Foundry treats synthesised keyboard events. Added 2026-08-09.
 *
 * This is the one question the whole modifier feature rests on, and it cannot be answered by any test
 * in this repo: jsdom has no Foundry, and the Chromium tests run against a stub that believes whatever
 * we tell it. Only a real Foundry knows whether its KeyboardManager updates downKeys from an event
 * whose isTrusted is false.
 *
 * Run: npm run probe:foundry     (a Foundry must be running with a world launched)
 *
 * The answer as of 2026-08-09 on 14.365 is `events`. See ADR 0004. The session handling lives in
 * foundry-session.ts, which records why each step of the login is shaped the way it is.
 */
import {
  BASE,
  MODULE_ID,
  captureModuleLog,
  ensureModuleEnabled,
  joinWorld,
  launchBrowser,
  requireActiveWorld,
} from './foundry-session.ts';

/**
 * Measure the same thing the module measures, without asking the module.
 *
 * The module reports its own strategy, but that value is derived from its own probe, so quoting it
 * back proves only that it is self consistent. This dispatches an independent event and reads
 * downKeys directly, so the two can be compared and a disagreement is visible rather than assumed
 * away. It cleans up after itself whatever the answer.
 */
async function independentProbe(page: Page) {
  return page.evaluate(() => {
    const downKeys = game.keyboard?.downKeys;
    if (downKeys === undefined) {
      return { measurable: false, reason: 'game.keyboard.downKeys does not exist on this build' };
    }
    if (downKeys.has('ShiftLeft')) {
      return { measurable: false, reason: 'ShiftLeft was already held, so the probe would lie' };
    }

    const event = new KeyboardEvent('keydown', {
      code: 'ShiftLeft',
      key: 'Shift',
      bubbles: true,
      cancelable: true,
      composed: true,
      shiftKey: true,
    });
    document.dispatchEvent(event);

    const honoured = downKeys.has('ShiftLeft');

    document.dispatchEvent(
      new KeyboardEvent('keyup', { code: 'ShiftLeft', key: 'Shift', bubbles: true })
    );
    downKeys.delete('ShiftLeft');

    return {
      measurable: true,
      isTrusted: event.isTrusted,
      honoured,
      strategy: honoured ? 'events' : 'direct',
      downKeysType: downKeys.constructor?.name ?? null,
    };
  });
}

async function main() {
  const status = await requireActiveWorld();
  const { browser, page } = await launchBrowser();
  const log = captureModuleLog(page);

  try {
    await joinWorld(page);
    const enabled = await ensureModuleEnabled(page);

    const reported = await page.evaluate((id) => {
      const entry = game.modules.get(id);
      return {
        found: entry !== undefined,
        active: entry?.active ?? false,
        version: entry?.version ?? null,
        strategy: entry?.api?.getKeyboardStrategy?.() ?? null,
      };
    }, MODULE_ID);

    const measured = await independentProbe(page);

    console.log(
      JSON.stringify(
        {
          target: BASE,
          world: status.world,
          core: status.version,
          enabledByThisRun: enabled,
          reported,
          measured,
          log,
        },
        null,
        2
      )
    );

    if (
      reported.strategy !== null &&
      measured.measurable &&
      reported.strategy !== measured.strategy
    ) {
      console.error(
        `\nDISAGREEMENT: the module reports '${reported.strategy}' but an independent probe measured ` +
          `'${measured.strategy}'. One of the two is wrong and it matters which.`
      );
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

await main();
