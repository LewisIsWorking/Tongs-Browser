#!/usr/bin/env node
/**
 * Two finger pan and pinch, against a real Foundry canvas. Added 2026-08-09.
 *
 * Run: npm run check:multitouch     (a Foundry must be running with a world launched)
 *
 * ADR 0006 covered single finger touch and named multi touch as the remaining gap. Closing it found
 * a real bug on the first attempt, which is recorded in ADR 0007: the pinch was building on a
 * remembered scale of 1 rather than on the scale the canvas was actually at, so the first pinch of
 * every session lurched by a factor of 1/initialScale.
 *
 * That is why the pinch assertion here is a RATIO between the scale before and after, compared
 * against the ratio the fingers moved. An assertion against an absolute scale would have passed
 * happily while the canvas jumped, because the number it jumped to was itself perfectly predictable.
 *
 * ⚠️ WRITES TO A LIVE WORLD: creates a `[probe]` scene when there is no active one, deletes it in a
 *    finally.
 */
import type { Page } from 'playwright';
import { type ClientPoint } from '../foundry-session.ts';
import { viewport, type Viewport } from './support.ts';
import { type Recorder } from '../live/recorder.ts';
import { Hand } from '../foundry-touch.ts';

/**
 * Pinch to zoom, measured against the scale the canvas is ACTUALLY at. Extracted from
 * foundry-multitouch-check 2026-08-12.
 *
 * ⚠️ Kept as a pair. A pinch that scales correctly outward and does not come back is a bug that
 * neither check finds alone, which is why the reversibility one takes the first one's result.
 */

/**
 * A pinch scales the canvas RELATIVE to where it already was.
 *
 * This is the regression guard for ADR 0007. Before the fix, a canvas sitting at 0.5 took a 1.6x
 * pinch and landed on 1.6, a jump of 3.2x, because the controller multiplied the ratio onto a
 * remembered 1 and applied the result absolutely.
 */
export async function checkPinchIsRelative(
  page: Page,
  hand: Hand,
  centre: ClientPoint,
  recorder: Recorder
): Promise<Viewport> {
  const before = await viewport(page);

  const startGap = 100;
  const endGap = 160;
  const fingerRatio = endGap / startGap;

  await hand.start([
    { x: centre.x - startGap, y: centre.y },
    { x: centre.x + startGap, y: centre.y },
  ]);
  await hand.move([
    { x: centre.x - endGap, y: centre.y },
    { x: centre.x + endGap, y: centre.y },
  ]);
  await hand.end();

  const after = await viewport(page);
  const appliedRatio = after.scale / before.scale;
  const error = Math.abs(appliedRatio - fingerRatio) / fingerRatio;

  recorder.record(
    'pinch scales relative to where the canvas already was',
    error < 0.05,
    `scale ${before.scale} -> ${after.scale}, applied ratio ${appliedRatio.toFixed(3)} against a ` +
      `finger ratio of ${fingerRatio.toFixed(3)}, error ${(error * 100).toFixed(1)}%`
  );

  return after;
}

/** Pinching back in returns roughly where it started, so the two directions agree. */
export async function checkPinchIsReversible(
  page: Page,
  hand: Hand,
  centre: ClientPoint,
  beforePinch: { readonly scale: number },
  recorder: Recorder
): Promise<void> {
  await hand.start([
    { x: centre.x - 160, y: centre.y },
    { x: centre.x + 160, y: centre.y },
  ]);
  await hand.move([
    { x: centre.x - 100, y: centre.y },
    { x: centre.x + 100, y: centre.y },
  ]);
  await hand.end();

  const after = await viewport(page);
  const drift = Math.abs(after.scale - beforePinch.scale) / beforePinch.scale;

  recorder.record(
    'pinching back in returns to roughly the starting zoom',
    drift < 0.05,
    `back to ${after.scale.toFixed(4)} from a start of ${beforePinch.scale.toFixed(4)}, ` +
      `drift ${(drift * 100).toFixed(1)}%`
  );
}
