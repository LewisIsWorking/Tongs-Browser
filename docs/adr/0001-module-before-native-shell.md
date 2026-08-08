# 1. Ship a Foundry module before a native Android shell

Date: 2026-08-08

Status: Accepted

## Context

The problem is that Foundry VTT assumes a mouse. On a phone or tablet there is no persistent pointer,
so three things are broken at once:

- Hover states never fire. Tooltips, token nameplates on hover, and the PF2e HUD panels are all dead,
  because none of them have a touch equivalent.
- Precise targeting is guesswork, because a fingertip is larger than most Foundry controls and
  covers the thing being aimed at.
- Modifier held actions are unreachable. Shift drag to rotate a token, ctrl click to snap a measured
  template, alt to preview vision.

Two routes lead to a persistent pointer.

**A Foundry module** synthesises the pointer in JavaScript, inside whatever browser the player
already uses. Events it creates are untrusted, in the `isTrusted === false` sense, which may matter
in places.

**A native Android shell** wraps a WebView and injects real `MotionEvent`s with `TOOL_TYPE_MOUSE`,
so Chromium generates genuinely trusted mouse events indistinguishable from a physical mouse.

The native route produces a better pointer. The question is which to build first.

## Decision

Build the module first. Design it so the native shell can coexist with it later rather than replace
it.

## Rationale

**Distribution.** The target user plays on The Forge. Installing a module there is pasting a manifest
URL into a box. Distributing an Android app means either the Play Store, with its review process and
per release turnaround, or sideloading, which is a barrier for anyone the project might later be
shared with.

**Reach.** A module works on iOS, on a desktop browser with a touchscreen, and on any Android
browser. The native shell covers Android only. Since the module is where the pointer logic lives
either way, building it first means the logic is exercised on every platform rather than one.

**Maintenance cost per Foundry release.** A module tracks Foundry's API and breaks in ways that are
visible and fixable in JavaScript. A native shell adds a second thing to keep working, and its
breakages are harder to diagnose because they happen a layer below the page.

**The uncertainty is in the module, not the shell.** Whether Foundry honours synthetic keyboard
events, whether hover sequences drive the PF2e HUD correctly, what the right gesture vocabulary is:
none of these can be answered by building an app. They can only be answered by a module in front of
a real game. Building the shell first would mean investing in the easier half before learning whether
the harder half works.

**The shell is strictly additive.** Nothing built here is wasted if the shell follows. The gesture
layer, the event sequences, the modifier bar and the scaling all keep their value; only the
transport for pointer events changes.

## Consequences

Synthesised events carry `isTrusted === false`. That is accepted, with one known area of doubt around
Foundry's keyboard handling, which is measured at runtime rather than assumed. See
`KeyboardSynthesizer` and ADR 0003.

The module cannot control the viewport the way a WebView host can. `setInitialScale` and
`setUseWideViewPort` have no browser equivalent, so interface scaling is done with CSS transforms,
which is a coarser tool.

Some things stay out of reach entirely: keeping the screen on, immersive fullscreen, trapping the
back button, and reliable cookie persistence for Forge authentication. These are the shell's job, and
they are the reason phase 2 remains worth doing rather than being made redundant by this work.

See ADR 0002 for the phase 2 design and the open question about how the two halves should behave when
both are present.
