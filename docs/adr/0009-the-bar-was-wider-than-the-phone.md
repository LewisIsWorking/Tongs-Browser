# 0009. The modifier bar was wider than the phone it was built for

Date: 2026-08-10

Status: accepted

## Context

Everything before this was measured on desktop Chrome pretending to be Android: a touch context, a
narrow viewport, touch events injected through CDP. That is a good approximation and it found real
bugs, but it is an approximation, and the one thing this module exists for is a screen too small for
Foundry's own stated minimum. A desktop window resized to 412px is not the same thing as a device
that is 412px.

Chrome on Android exposes DevTools over an abstract socket, so `adb forward tcp:9222
localabstract:chrome_devtools_remote` makes a real device drivable by exactly the same Playwright
code the other checks use. `npm run check:android` is that harness. Measured against the `coo_phone`
emulator at 412x783, dpr 2.625, five touch points, Foundry 14.365.

## Decision

Wrap the modifier bar, bound it to the viewport, and clamp its position. Keep the 44px keys.

## What the device said that desktop never could

**The bar did not fit, and no position could have made it fit.** Eight 44px keys plus the drag
handle, the collapse button and the gaps come to 444px. On a 412px viewport the bar rendered from
x 88 to x 532, leaving **Esc, Enter and Tab entirely off screen**. This is the module's own control
surface, on the module's own target device, and nothing had ever measured it.

The instinct is to move it left. That is wrong: 444 does not fit into 412 anywhere, so this is a
reflow problem wearing a positioning problem's clothes. Hence `flex-wrap: wrap` plus a
`max-width: calc(100vw - 8px)`, and not a smaller default x.

Wrapping rather than shrinking is deliberate. 44px is the touch target minimum, so smaller keys
would trade three unreachable keys for eight harder to hit ones, which is the worse bargain on
exactly the device this is for.

**There was no clamping anywhere in the class.** `applyPosition` wrote `left` and `top` straight from
the stored position, so the bar could be dragged off screen and never come back, and a rotation into
a narrower viewport would strand it. Now clamped, and the clamp is written back to `this.position`
rather than applied only to the style: `onHandlePointerDown` builds its drag offset from
`this.position`, so clamping only the rendering would make the next grab jump by the difference.

⭐ **Why the unit suite could never have caught it.** jsdom reports `offsetWidth` as 0, so a bar with
no layout has no width, and a width of 0 fits in every viewport. The guards added with this change
stub the size explicitly, using the numbers the device produced, and were proven by removing the
clamp and watching exactly four of them fail.

## What was confirmed rather than discovered

- **Keyboard strategy on Android is `events`**, matching the desktop finding in ADR 0004, and checked
  independently rather than by trusting the module's own log line: `isTrusted=false`, `downKeys` is
  still a `Set`, and the synthesised keydown registered.
- The scene control toggle from ADR 0008 is present in the `tokens` group, on screen, and passes a
  hit test at phone width. The bar's default no longer covers it.
- Tap clicks at the pointer and not under the finger, with the pointer parked on a sidebar tab and a
  real finger tapping the canvas far away, judged by `ui.sidebar.tabGroups`.

## A trap worth writing down, because it cost the most time

On this emulator Foundry never became ready: `game.ready` stayed `false` forever while the entire
interface painted normally. It looked exactly like a module having broken the world.

It was none of ours. `fonts/fontawesome/webfonts/fa-duotone-900.woff2` downloads perfectly, HTTP 200
and 326,968 bytes, and then **fails to decode** on Chromium 133. Chromium reports an OTS font parse
failure as `NetworkError: A network error occurred.`, which is why it reads as a connectivity problem
and is not one. Foundry does not catch the rejection, so startup stops.

Two things made this hard to see and are worth remembering:

- The `coo` system installs a global `unhandledrejection` listener, so the console said
  `coo | UNHANDLED REJECTION ...` and sent us looking at a system that was only the reporter. The
  same failure appeared under Simple Worldbuilding once we looked.
- "NetworkError" for a parse failure is a genuinely misleading name. The bytes had already arrived.

`check:android` installs a narrow shim that swallows font decode rejections and nothing else, and it
**reports every font it swallows as a check result**, because an environment fix that hides itself
would make every later result rest on it silently.

This is a property of Chromium 133, which is below the 146 Foundry 14.365 asks for. A current phone
will not have it. It is an emulator limitation, not a shipped bug, and it is not worked around in the
module.

## Consequences

- `npm run check:android` needs the adb forward and `FOUNDRY_URL` pointing at the device visible host
  address, which on an emulator is `10.0.2.2`. `HOST_BASE` and `BASE` are now separate for this
  reason: the address Node can reach and the address the browser can reach are only accidentally the
  same on desktop.
- The scene creation and touch drivers moved into `foundry-session.mjs` and `foundry-touch.mjs` when
  this became their third caller.
- Still untouched by any automation: hover semantics, the real PF2e module stack, and ergonomics.
