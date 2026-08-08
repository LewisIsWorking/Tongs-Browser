# tongs-browser

## 0.2.0

### Minor Changes

- [#5](https://github.com/LewisIsWorking/Tongs-Browser/pull/5) [`cf6dfd4`](https://github.com/LewisIsWorking/Tongs-Browser/commit/cf6dfd4d1b48d568642a66f2a633d90e85aa0633) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add interface scaling and application window clamping.

  Foundry's HTML chrome is scaled by a single CSS custom property, between 50 and 100 percent in five
  percent steps, with each region anchored to the edge it is pinned to. The canvas is never scaled.
  Application windows are clamped into the viewport for both the legacy and ApplicationV2 systems,
  since a sheet opening off screen on a touch device takes its close button with it and cannot be
  recovered.

  Also corrects a premise carried from the original design: browser hit testing is transform aware,
  so the pointer must keep using raw viewport coordinates while the interface is scaled. Verified
  against Chromium. A test pins the decision so the UI scale cannot later be wired into the hit
  tester, which would break a case that currently works.

- [#3](https://github.com/LewisIsWorking/Tongs-Browser/pull/3) [`686561e`](https://github.com/LewisIsWorking/Tongs-Browser/commit/686561e52f3b1934dc4648a308da673563a2efd0) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the gesture layer and wire the module up so it runs.

  A finite state machine with explicit named states translates touches into pointer actions: tap to
  click at the pointer rather than at the finger, long press to right click, double tap, tap then hold
  to begin a drag, two finger pan, and pinch to zoom. The machine is pure, taking timestamps as input
  and requesting timers as actions, so every transition is tested without a DOM or a clock.

  Text inputs, contenteditable regions, the chat log and the sidebar are excluded, so typing and
  native scrolling keep working. Real touch derived pointer events are suppressed at the capture
  phase, behind its own toggle since that is the most likely source of conflict with another module.

- [#1](https://github.com/LewisIsWorking/Tongs-Browser/pull/1) [`b83c47f`](https://github.com/LewisIsWorking/Tongs-Browser/commit/b83c47fa297acb597ac4475214175e8f62ecf1d4) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the project scaffold: TypeScript 6 in strict mode, Vite library build producing
  `dist/tongs-browser.js` and `dist/tongs-browser.css`, Vitest split into a DOM free unit project and
  a jsdom project, ESLint with type aware rules, Prettier, an em dash check covering every tracked
  file, the Foundry manifest, hand written Foundry ambient types, and CI covering lint, typecheck,
  test, build and tagged releases.

- [#4](https://github.com/LewisIsWorking/Tongs-Browser/pull/4) [`5ed5eeb`](https://github.com/LewisIsWorking/Tongs-Browser/commit/5ed5eeb60dc5d62bd75988705fe4f5b35788f3ad) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the sticky modifier key bar.

  A floating, draggable, collapsible bar offering Ctrl, Shift, Alt, Space, Delete, Escape, Enter and
  Tab. Modifiers latch on tap, lock on a second tap, and release on a third. Latched keys clear after
  one action while locked ones stay held. Events are dispatched by `code`, which is what Foundry's
  keybinding system matches on.

  Includes a startup probe that measures whether this Foundry build honours synthesised keyboard
  events, falling back to writing the keyboard manager's held key set directly, with a warning, when
  it does not.

- [#2](https://github.com/LewisIsWorking/Tongs-Browser/pull/2) [`f25481a`](https://github.com/LewisIsWorking/Tongs-Browser/commit/f25481a7e842f9564fcaab4a43778b7497860343) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the pointer core: the event synthesis engine behind the virtual mouse.

  Event sequences are pure functions returning ordered descriptors, dispatched by a separate thin
  dispatcher, so the ordering logic is tested in plain node with no DOM. Covers hover transitions on
  target change, left and right click, double click, dragging with the buttons bitmask held across
  the move stream, and pixel mode wheel events. Both PointerEvent and legacy MouseEvent are emitted.

  Includes the coordinate transform that converts between drawn and hit tested space, without which
  clicks land somewhere other than where the cursor appears once the interface is scaled.

- [#6](https://github.com/LewisIsWorking/Tongs-Browser/pull/6) [`984c090`](https://github.com/LewisIsWorking/Tongs-Browser/commit/984c0902b9698c4fb3f4383541c6e0656597879a) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add client settings and a scene control toggle.

  All eleven settings from the design are registered as client scope, so each player configures their
  own device, and every one applies live rather than needing a reload. Values are validated and
  clamped on read rather than cast, so a setting written by an older version or edited by hand cannot
  reach the gesture config as a NaN.

  The scene control button matters more than convenience suggests: if the pointer misbehaves mid
  session, reaching the settings dialog to disable it means using the pointer to do so.

  Also adds the debug overlay, which outlines the element the pointer currently resolves to and logs
  every synthesised event.

### Patch Changes

- [#7](https://github.com/LewisIsWorking/Tongs-Browser/pull/7) [`076f2d9`](https://github.com/LewisIsWorking/Tongs-Browser/commit/076f2d919aae85973a415e6a7ae5f5f5e802711c) Thanks [@LewisIsWorking](https://github.com/LewisIsWorking)! - Add the README, the architecture decision records and the manual testing checklist.

  ADR 0003 records what was empirically verified about PIXI, hit testing and CSS transforms, including
  the two places where the original design assumptions turned out to be wrong: Foundry runs PIXI v7
  rather than v8, and browser hit testing is transform aware so no coordinate conversion is needed.
