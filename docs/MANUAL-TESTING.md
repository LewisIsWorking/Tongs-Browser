# Manual testing checklist

Everything here needs a real Android device against a real Foundry instance. None of it can be
covered by the automated tests: jsdom has no layout engine, no touch hardware and no PIXI, so the
test suite verifies event ordering and state transitions but can say nothing about whether Foundry
responds to them.

Work through this on a phone and on a tablet if you have both, since the default pointer modes differ
between them.

## Setup

- Foundry version tested: `_____________`
- Device and Android version: `_____________`
- Browser: `_____________`
- Pointer mode: trackpad / offset
- Module version: `_____________`

Have these installed, since they are the live stack this is built for: **PF2e system**, **PF2e HUD
(reonZ)**, **PF2e Workbench**, **Health Estimate**.

## Before anything else

- [ ] Open the browser console. At `ready` the module logs
      `Keyboard strategy: <events|direct|unknown>`. Record it here: `_____________`
- [ ] The cursor is visible and moves when you drag one finger.
- [ ] The modifier bar is visible and can be dragged by its handle.

That keyboard strategy is the answer to the question that decides whether the modifier bar works at
all. `events` means Foundry honours synthesised keyboard events and nothing further is needed.
`direct` means it does not, and the module is writing Foundry's internal held key set as a fallback.
`unknown` means the probe could not run, usually because you were holding shift on a physical
keyboard at the time.

> **Already answered on desktop: `events`.** Measured 2026-08-09 on Foundry 14.365 in headless
> Chrome, with `isTrusted: false` confirmed on the event and `downKeys` confirmed still to be a `Set`.
> See [ADR 0004](adr/0004-foundry-honours-synthetic-keyboard-events.md). The result is expected to
> carry to Android, since `isTrusted` behaves the same in every browser and `KeyboardManager` is the
> same code, but expected is not measured, so still record what the device says. A `direct` or
> `unknown` reading on the tablet when desktop says `events` is a real finding, not a nuisance.

Run `npm run probe:foundry` against any running Foundry to get this answer without a device. It joins
the world, enables the module if needed, and takes its own independent measurement rather than
trusting the module's own report.

## Last full run against a live Foundry

**v0.25.65 on Foundry 14.366, 2026-08-20.** World `cootestworld`, system `coo` 0.76.0, desktop
Chrome. Every harness green:

| Harness                 | Result                                                    |
| ----------------------- | --------------------------------------------------------- |
| `check:foundry`         | 10 pass, no page errors                                   |
| `check:touch`           | 7 pass                                                    |
| `check:multitouch`      | pan, pinch and pinch back at 0.0% error                   |
| `check:grab`            | token moved (600,600) to (800,600) after a 700ms hold     |
| `check:drag --hold=700` | pass, `screenOrigin` pinned at 800 across 12 samples      |
| `probe:play`            | 9 of 9 capabilities, controls forced and agreeing, 0 gaps |

⚠️ Run because four releases had shipped since the module was last loaded into a real Foundry, and
those releases deleted six exports from `src/` and changed the gesture path. A green unit suite says
nothing about whether Foundry still accepts what the module sends. Only this does.

⚠️ Run the play probe with `PROBE_FORCE_CONTROL=1`. Without it the native controls execute only when a
pointer path has already failed, so they can sit broken for months and nobody finds out until the one
moment they are relied on. That is not hypothetical: the controls could not select a token at all on
14.366, because they pressed without moving the pointer first, and Foundry's `#handleLeftDown` returns
unless its state has reached HOVER.

## What is already verified against a real Foundry

`npm run check:foundry` covers these on desktop, so a failure on the tablet is a **device specific**
finding rather than a broken module. Measured 2026-08-09 on 14.365, see
[ADR 0005](adr/0005-both-interaction-surfaces-accept-the-virtual-pointer.md):

- The cursor and modifier bar attach, and the cursor is never what the hit test finds, on real
  Foundry layout rather than a stub.
- Foundry's HTML chrome accepts a synthesised click, judged by `ui.sidebar.tabGroups`.
- The PIXI canvas tracks a synthesised pointer move, judged by `canvas.mousePosition`.
- The module raises no page errors through init, enable and a canvas draw.

`npm run check:touch` adds the touch half, using trusted touch injected through CDP so the browser
emits its own compatibility events exactly as a tablet does. Measured 2026-08-09, see
[ADR 0006](adr/0006-real-touch-input-drives-the-gesture-machine.md):

- One finger drag moves the pointer, at the configured 1.5x sensitivity.
- **Tap clicks at the pointer, not the finger.** Pointer parked on a sidebar tab, finger tapped far
  away over the canvas, tab changed. This is the trackpad model working.
- Long press produces a right click at the pointer, under real event timing.
- The browser's own touch derived pointer events never reach Foundry, so no gesture is acted on twice.

`npm run check:multitouch` adds two fingers. It found a real bug the first time it ran, fixed in
[ADR 0007](adr/0007-pinch-must-build-on-the-canvas-actual-scale.md): the pinch built on a remembered
scale of 1 rather than the scale the canvas was at, so on a scene loaded at 0.5 the first pinch
jumped 3.2x instead of 1.6x. **If you tested a build before 2026-08-09 and the first pinch felt
violent, that was this and it is fixed.**

- Two finger drag pans the canvas, map moving with the fingers, without changing the zoom.
- Pinch scales relative to wherever the canvas already is, and pinching back in returns to the start.

`npm run check:drag` answers the one question none of the above can: **does a token actually move?**
It drives the module's own virtual pointer through grab, move and drop against a live world, and
passes only if `token.document.x` ends up roughly where the pointer went. Every other drag test in
this repo asserts on the event stream, which stayed green through three releases that a real phone
said were broken. See [ADR 0011](adr/0011-a-drag-is-a-token-that-moved.md), which is worth reading
before adding a check of your own: three of its four safeguards exist because this check accused the
module of a bug that was in the check.

Measured 2026-08-11 against Foundry 14.365: pointer, Foundry's drag destination, the drag clone and
the committed document all track a 240px drag. **Dragging works.** What did not work was the grab
button never saying it was still holding something, so a held grab reads exactly like a dead drag.

- A 240px drag moves the token about 240 canvas units, allowing one grid square for snapping.
- The grab button reads `DROP` while it holds, and Foundry commits the move on that drop.

⚠️ **Desktop passing is not the phone passing.** A device on Chrome 150 still reports a token that
does not move, with `PEAK state: GRABBED (3)`, while this check is green on desktop against the same
build. So run it on the hardware:

```bash
adb forward tcp:9222 localabstract:chrome_devtools_remote
FOUNDRY_URL=http://<host-lan-ip>:30000 npm run check:drag -- --android
```

The drag distance becomes a third of the viewport there rather than a flat 240px, because the hit
tester clamps the pointer inside the viewport and a 240px drag across a 360px phone would run into
the edge, move the token less than asked, and report "the drag is not following the pointer" about
the harness's own arithmetic. It also **does not close the browser** on the way out, since that is
the user's own Chrome with their own tabs in it.

`npm run check:android` runs all of the above shapes against **Chrome on a real Android device**,
over the DevTools socket `adb` forwards, so the viewport is a real phone viewport and the touchscreen
is real hardware. Measured 2026-08-10 on the `coo_phone` emulator at 412x783, dpr 2.625, Foundry
14.365, see [ADR 0009](adr/0009-the-bar-was-wider-than-the-phone.md). It found a real bug on its
first run:

- **The modifier bar was wider than the phone.** 444px of bar on a 412px screen put **Esc, Enter and
  Tab entirely off screen**, at any position. Fixed by wrapping the bar rather than shrinking the
  keys, since 44px is the touch target minimum. **If you tested a build before 2026-08-10 and thought
  some modifier keys were missing, that was this.**
- The bar also had **no clamping at all**, so it could be dragged off screen and never come back.
- Keyboard strategy on Android measured **`events`**, matching desktop, and verified independently
  rather than read from the module's own log line.
- The scene control toggle is present, on screen and passes a hit test at phone width.
- Tap clicks at the pointer and not under the finger, on real touch hardware.

To run it:

```bash
adb forward tcp:9222 localabstract:chrome_devtools_remote
FOUNDRY_URL=http://10.0.2.2:30000 npm run check:android
```

> ⚠️ On an emulator whose Chromium is older than 136, Foundry never becomes ready: `game.ready` stays
> `false` while the whole interface paints. That is not this module. `fa-duotone-900.woff2` downloads
> fine and then fails to decode, and Chromium reports a font parse failure as
> `NetworkError: A network error occurred.`. The check shims that one rejection and reports every
> font it swallows. A current phone will not have this.

### Can the pointer actually play the game? `npm run probe:play`

A capability matrix rather than a pass/fail check, measured 2026-08-10 on desktop Chrome against
Foundry 14.365. Anything that fails is retried with a **native control** dispatched straight at the
canvas with the module bypassed, so a red says whose fault it is (ADR 0010).

Every trial builds its **own** actor and token and deletes them again, every path runs **three
times**, and the aim is asserted as its own precondition. A gap is claimed only when the pointer fails
every trial and a native control succeeds in every trial.

| capability                           | via pointer   | native control           |
| ------------------------------------ | ------------- | ------------------------ |
| select a token                       | ✅ yes        | not needed               |
| open the token HUD, right click      | ✅ yes        | not needed               |
| drag a token to a new square         | ✅ yes        | not needed               |
| zoom with the wheel                  | ✅ yes        | not needed               |
| roll dice from the chat box          | ✅ yes        | not needed               |
| assign ownership and have it persist | ✅ yes        | not needed               |
| drop a token from actor sidebar      | ✅ yes        | not needed               |
| open a character sheet, double click | ❌ no         | also fails, inconclusive |
| create an actor from the sidebar     | ⚠️ aim failed | harness limitation       |

**Zero confirmed capability gaps.** Seven of nine work reliably through the virtual pointer, three
trials each.

- **Character sheet on double click** fails for a hand built native event too, so scripted input
  cannot express it here and nothing is concluded about the module.
- **Create an actor from the sidebar** is a **harness** limitation, not a finding: the probe cannot
  locate the sidebar create button in a headless window, so it reports `AIM FAILED` rather than a
  verdict it has not earned. Worth doing by hand on the device.
- **Assigning ownership** drives the Save press through the pointer and asserts the ownership
  persisted on the document. The `<select>` itself is set programmatically, and that is a genuine
  limit rather than a shortcut: a native dropdown is operating system UI that no synthesised pointer
  event can open on any platform.

> ⚠️ **Two earlier versions of this table were wrong, both claiming gaps that did not exist**, at one
> point calling dragging "the biggest hole in the module". Every failure they reported survived
> isolation intact. Three causes, all now fixed: the control ran only _after_ the subject had already
> failed, from the state that failure left behind; a single trial was reported as fact; and all
> capabilities shared **one** actor, **one** token and one accumulating world, so each case inherited
> the wreckage of the last. A probe that reuses a fixture across cases measures history, not
> behaviour.

> ⚠️ Foundry 14's chat box is a `<prose-mirror>` element, not a `<textarea>`. Setting `.value` does
> nothing at all, silently. Type through the contenteditable the editor owns.

### Hover and tap on Android, both open

`check:android` now covers hover, and every failure it reports runs a **control** that bypasses the
module first, so a red result says whose fault it is. See
[ADR 0010](adr/0010-a-check-must-say-whose-fault-it-is.md).

- ⏭️ **Hover cannot be measured on a Chromium 133 emulator, and that is not this module.** A hand
  built `pointermove` with the module bypassed also fails to hover, while the same control succeeds
  on desktop Chrome. Reported as a skip, not a pass and not a failure. **Closing this needs a device
  with Chromium 146 or newer**, which is what Foundry 14.365 asks for anyway.
- ❌ **Tap does not activate a sidebar tab on Android, and this one does look like ours.** The tap
  delivers `pointerdown`, `mousedown`, `pointerup` and `mouseup` to the right element and **no
  `click`**, while a plain scripted click on the same element works. Unexplained: the same check
  passed earlier on the same emulator against a Simple Worldbuilding world, and the regression
  coincides with a world running the coo system. **Top of the backlog.**

**Not covered by any of that**, so these remain entirely on you: whether hover actually produces
nameplates, tooltips and PF2e HUD panels, as opposed to the position merely tracking; the exclusion
zones under real fingers, since the harness never taps a chat log or a text input; everything Android
specific, including the real module stack this is built for; and ergonomics, which is the reason the
module exists and which no automated check can judge.

## Pointer basics

- [ ] One finger drag moves the pointer, and it stays where you leave it.
- [ ] Tap clicks **at the pointer**, not where your finger landed. This is the trackpad model and it
      is deliberate. If it clicks under your finger, something is wrong.
- [ ] The pointer stops at the screen edge rather than disappearing, and comes straight back when you
      drag the other way with no dead zone to swipe through.
- [ ] Sensitivity changes take effect immediately, without a reload.

## Hover, which is the whole reason this exists

- [ ] Hovering a token shows its nameplate.
- [ ] Hovering a control shows its tooltip.
- [ ] **PF2e HUD panels appear on hover** over a token.
- [ ] Moving the pointer between two tokens updates the hover, rather than leaving the first one lit.
- [ ] Health Estimate shows its estimate on hover.

## Clicks

- [ ] Tap selects a token.
- [ ] Double tap opens the character sheet.
- [ ] Long press opens the token HUD, the right click menu.
- [ ] Long press vibrates briefly, if haptics are on and the device has a vibrator.
- [ ] Long press then releasing does **not** also fire a left click.
- [ ] Long press, then moving without lifting, moves the pointer rather than doing nothing.

## Dragging, the hard one

- [ ] Tap then immediately press and hold begins a drag. The cursor changes to the held state so it
      is obvious.
- [ ] A token can be dragged to a new square and dropped.
- [ ] Dropping a token does **not** also click whatever is underneath it.
- [ ] The ruler can be dragged out, and **waypoints can be placed** mid drag.
- [ ] A measured template can be placed by dragging.
- [ ] Backgrounding the app mid drag does not leave a token stuck to the pointer.

## Modifiers

- [ ] Tapping Shift on the bar latches it, shown distinctly.
- [ ] Tapping it again locks it, shown differently again from latched.
- [ ] Tapping a third time releases it.
- [ ] **Shift drag rotates a token.** If this fails but the bar shows shift latched, the keyboard
      strategy above is the thing to look at.
- [ ] Ctrl click snaps a measured template.
- [ ] Alt shows vision preview.
- [ ] Delete removes a selected token.
- [ ] Escape closes an open sheet.
- [ ] A latched modifier clears after use. A locked one does not.

## Canvas

- [ ] Two finger drag pans the map, and the map moves **with** the fingers.
- [ ] Pinch zooms.
- [ ] Pinch does not lurch or fight the pan.
- [ ] Zoom stops at sensible limits rather than vanishing to a dot or filling the screen with one
      square.
- [ ] Panning does not select tokens or draw a selection box.

## The parts that must keep working untouched

These are the exclusion zones. Failure here is worse than a missing feature, because it breaks
something that worked before the module was installed.

- [ ] Tapping the chat box opens the keyboard and shows a caret.
- [ ] Typing in chat works normally, including autocorrect and the enter key.
- [ ] **The chat log scrolls with a finger**, with normal momentum.
- [ ] The sidebar scrolls.
- [ ] Long lists inside sheets scroll.
- [ ] Text can be selected in a journal entry.

## Interface scaling

- [ ] At 75 percent the sidebar and controls are visibly smaller.
- [ ] Nothing is pushed off screen, particularly the right sidebar and the bottom hotbar.
- [ ] **Taps land where the cursor is drawn** at every scale. Check at 50, 75 and 100 percent.
      A mismatch here is the failure the coordinate work was meant to prevent, so record it in detail
      if it happens.
- [ ] A character sheet opens fully on screen with its close button reachable.
- [ ] Scene control buttons are still comfortably tappable at 50 percent.

## Rolling and sheets

- [ ] A character sheet opens, scrolls, and closes.
- [ ] Rolling a check from the sheet works.
- [ ] Rolling damage from a chat card works.
- [ ] A PF2e Workbench automation prompt can be answered.

## Switching off

- [ ] The scene control button switches the module off in one tap.
- [ ] With it off, native touch behaves as it did before the module was installed.
- [ ] Switching it back on restores the pointer without a reload.
- [ ] Disabling mid drag does not leave anything stuck.

## Conflicts

- [ ] With TouchVTT also installed, note what happens: `_____________`
- [ ] With `suppressNativeTouch` off, note whether TouchVTT works normally: `_____________`

Record anything found here in the README's known conflicts section rather than silently working
around it.
