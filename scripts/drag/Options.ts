/**
 * How the drag check is asked to run. Extracted from foundry-drag-check 2026-08-12.
 *
 * Every flag here exists because a run answered one question and raised another, and the reasoning
 * is kept with the flag rather than in a README nobody opens while a check is failing.
 */
/**
 * `--android` drives Chrome on the actual phone instead of desktop Chromium.
 *
 * This check passes on desktop and the same gesture fails on a device, which means desktop can no
 * longer answer the question. Running the identical assertions against real hardware is the only way
 * to see the difference rather than infer it from a pasted report, and inferring it has now cost
 * three releases.
 *
 * Needs the adb forward and an address the DEVICE can reach:
 *
 *   adb forward tcp:9222 localabstract:chrome_devtools_remote
 *   FOUNDRY_URL=http://<host-lan-ip>:30000 npm run check:drag -- --android
 */
export const USE_ANDROID = process.argv.includes('--android');

/**
 * `--mobile` turns on the phone's INPUT characteristics: touch, a mobile user agent, dpr 3.
 *
 * A device fails a gesture this check passes on desktop, and no device is plugged in, so the only
 * way to see the difference rather than infer it is to make the desktop browser as much like the
 * phone as Chromium allows, one variable at a time. Emulation is a weaker claim than hardware and is
 * recorded as such.
 *
 * ⚠️ It deliberately does NOT shrink the viewport to the phone's 360x607, though that was the first
 * thing tried. **Foundry itself refuses to run below 1024x768** and replaces the whole interface with
 * a paragraph saying so, which the press-point guard caught immediately:
 *
 *   element there: p "Foundry Virtual Tabletop requires a usable window dimensions of 1024px by
 *   768px or greater."
 *
 * The phone only gets past that because this module's UI scaler makes Foundry believe the window is
 * larger than it is. So viewport size cannot be varied on its own here; it is entangled with the
 * scaler. Touch, the mobile user agent and the device pixel ratio can be, and they are the
 * candidates that would change how events are produced and mapped.
 *
 * dpr 3 comes from the device's own report: `viewRect=0,0 360x607 res=3`.
 */
export const USE_MOBILE = process.argv.includes('--mobile');
export const MOBILE_DPR = 3;

/**
 * `--pan` pans the canvas while the drag is in progress.
 *
 * The remaining candidate for a drag origin that follows the pointer. `screenOrigin` is in SCREEN
 * space, so when the canvas pans, the same world point lands on different screen pixels and Foundry
 * has to rewrite it or the drag would jump. That rewrite is correct in isolation. It stops being
 * correct if the canvas is panning WITH the pointer, because then the origin chases the pointer and
 * Foundry's 10px gate can never open however far you drag.
 *
 * On a phone, a one finger drag moves the pointer, and anything that also nudges the canvas would
 * produce exactly this. Desktop never pans during a drag, which is why desktop has never seen it.
 */
export const PAN_DURING_DRAG = process.argv.includes('--pan');

/**
 * How far to drag, and in how many steps.
 *
 * Foundry's MouseInteractionManager will not start a drag until the pointer has travelled its
 * `dragResistance` of 10px from the press, so a single large jump and a distance under 10 are both
 * ways to measure nothing. 240px over 12 steps clears the gate several times over and still looks
 * like a hand rather than a teleport. The grid in the probe scene is 100px, so this is a move of
 * more than two squares and cannot be confused with a snap back to the origin square.
 */
export const DRAG_DISTANCE = 240;

/**
 * `--steps=N` splits the same distance into N moves, which changes the SIZE of each one.
 *
 * That size turns out to matter enormously and nothing here was varying it. Desktop drags 240px in
 * 12 steps of 20px and clears Foundry's 10px gate on the very first move, while a finger on a phone
 * produced 55 moves of about 1.6px each for 86.5px of travel. Those are the same gesture to a human
 * and completely different event streams to Foundry, and only one of them had ever been tested.
 */
export const stepsArgument = process.argv.find((argument) => argument.startsWith('--steps='));
export const DRAG_STEPS = stepsArgument === undefined ? 12 : Number(stepsArgument.split('=')[1]);

/**
 * Foundry commits a token move by updating the document over the socket, which is a round trip even
 * against a local server. Polling for the change rather than sleeping means a fast machine finishes
 * immediately and a slow one still passes, and a genuine failure costs this long exactly once.
 */
export const COMMIT_TIMEOUT_MS = 8000;

/**
 * The same wait, on a device, where a Foundry socket round trip is a completely different animal.
 *
 * ⚠️ Measured 2026-08-11: a `deleteEmbeddedDocuments` issued to the phone took MINUTES to come back,
 * long enough that a desktop client deleted the same token first and the phone's call finally
 * returned "Token ... does not exist!". Pure JavaScript evaluated on that same tab returned
 * instantly, so this is not a slow device or a suspended tab: it is specifically the round trip
 * through Foundry's socket over wireless adb.
 *
 * Eight seconds would therefore have reported "the token did not move" about a move that was simply
 * still in flight, which is the harness accusing the feature for its own reasons. That has already
 * happened three times in this file and each time it cost a round of chasing the wrong thing.
 */
export const ANDROID_COMMIT_TIMEOUT_MS = 120_000;

/**
 * How far the committed position may differ from the distance dragged, in canvas units.
 *
 * One grid square. Snapping to the grid is allowed to move the result by up to half a square in each
 * axis, and the probe scene's grid is 100, so anything inside 100 is explained by snapping and
 * anything outside it is the drag not following the pointer.
 */
export const TRAVEL_TOLERANCE = 100;

/**
 * How long to hold the grab before moving, from `--hold=<ms>`. Added 2026-08-12.
 *
 * ⚠️ Default zero, because that is what every previous run did, and it is exactly why this check
 * passed against a bug a phone hit every time. Foundry arms a 500ms long press timer on pointerdown
 * and clears it only when a drag actually starts, so `--hold=700` is the interesting number: it is
 * roughly what a person takes between tapping the grab button and starting to drag. Foundry then
 * decides the pointer is being held still, pings the canvas, and cancels from
 * ControlsLayer._onLongPress.
 */
export const HOLD_MS = Number(
  process.argv.find((arg) => arg.startsWith('--hold='))?.slice('--hold='.length) ?? '0'
);
