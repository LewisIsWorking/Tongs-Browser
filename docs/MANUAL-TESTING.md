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

## What is already verified against a real Foundry

`npm run check:foundry` covers these on desktop, so a failure on the tablet is a **device specific**
finding rather than a broken module. Measured 2026-08-09 on 14.365, see
[ADR 0005](adr/0005-both-interaction-surfaces-accept-the-virtual-pointer.md):

- The cursor and modifier bar attach, and the cursor is never what the hit test finds, on real
  Foundry layout rather than a stub.
- Foundry's HTML chrome accepts a synthesised click, judged by `ui.sidebar.tabGroups`.
- The PIXI canvas tracks a synthesised pointer move, judged by `canvas.mousePosition`.
- The module raises no page errors through init, enable and a canvas draw.

**Not covered by any of that**, so these remain entirely on you: touch input and the gesture state
machine, since the check drives the pointer directly and has never seen a finger; whether hover
actually produces nameplates, tooltips and PF2e HUD panels, as opposed to the position merely
tracking; and everything Android specific.

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
