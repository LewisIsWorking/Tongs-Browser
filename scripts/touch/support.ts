import type { Page } from 'playwright';

import { MODULE_ID, type ClientPoint } from '../foundry-session.ts';

/** Matches SettingDefinitions. Asserted loosely, but the rough size comes from this. */
export const LONG_PRESS_MS = 500;

/**
 * The two things every touch harness asks the page. Extracted 2026-08-12 when the checks were split
 * across files and both halves needed them.
 *
 * ⚠️ Both read LIVE state through the module's own API rather than recomputing it. A harness that
 * derives where the pointer ought to be is testing its own arithmetic, and would agree with itself
 * about a pointer that never moved.
 */
/**
 * Where the canvas is looking: how far in, and at what.
 *
 * Both fields are needed together rather than separately, because every assertion in this file is a
 * comparison between two readings, and a pan is only correct RELATIVE to the scale it happened at.
 */
export interface Viewport {
  readonly scale: number;
  readonly pivot: ClientPoint;
}

export const viewport = (page: Page): Promise<Viewport> =>
  page.evaluate(() => ({
    scale: canvas.stage.scale.x,
    pivot: { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y },
  }));

export const pointerPosition = (page: Page): Promise<ClientPoint> =>
  page.evaluate((id: string) => {
    const position = game.modules.get(id).api.getPointer().getPosition();
    return { x: position.clientX, y: position.clientY };
  }, MODULE_ID);
