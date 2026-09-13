# First install on a real Forge instance

Written 2026-09-07, for v0.26.0, the first release carrying sheet creation, targeting and undo.
**Updated 2026-09-13 for v0.28.0**, the first release in which sheet creation actually works (step 5).

Everything before this was measured against a local Foundry through a headless browser and an
emulator. This is the first time the module meets a real instance, a real system and a real hand, so
the point of this page is that the first session **finds bugs rather than making a mess**.

## ⛔ Use a scratch world

Creating a character sheet, opening party access and undoing are all **writes to the world**. Make an
empty world with the system you care about and use that. A campaign is the wrong place to discover
that `addMembers` clears an actor's folder.

## Install

Paste into Foundry's **Install Module** box:

```
https://github.com/LewisIsWorking/Tongs-Browser/releases/latest/download/module.json
```

- [ ] The module list shows **0.28.0** or later, not `0.1.0`.

⚠️ `module.json` on `main` deliberately stays at the `0.1.0` placeholder; the real version is stamped
into the copy inside `module.zip` at release time. Seeing `0.1.0` means Foundry read the repo copy
rather than the release asset, which is the bug that once made every update invisible.

## The order to test in, and why

Cheapest and least destructive first. Each step is worth doing before the one after it, because a
failure in an early step explains a failure in a later one and not the other way round.

### 1. It loads at all

- [ ] Open the browser console, filter to `Tongs Browser`.
- [ ] A `Ready` line appears at Foundry's `ready` hook.
- [ ] It reports `Keyboard strategy: events`.

⚠️ **This line decides whether half the module works**, so read it before anything else. `events`
means Foundry honours the synthesised keyboard and every modifier, the target key and undo are all
live. `direct` means it does not and the module is writing Foundry's internal held-key set instead.
`unknown` means the probe could not run. Desktop and Android both measured `events`
([ADR 0004](adr/0004-foundry-honours-synthetic-keyboard-events.md),
[ADR 0009](adr/0009-the-bar-was-wider-than-the-phone.md)); a third answer here is a real finding.

### 2. Nothing is written yet: pointer, hover, click

- [ ] The cursor appears and one finger moves it.
- [ ] Hovering a token shows its nameplate, and the system's own hover panels appear.
- [ ] A tap clicks **at the pointer**, not under your finger.
- [ ] The modifier bar is on screen and can be dragged by its handle.
- [ ] Every bar control is reachable at your screen width, including the last ones.

### 3. Still no writes: the canvas

- [ ] Two finger drag pans, pinch zooms.
- [ ] 🎯 targets the token under the pointer, and tapping it again clears the target.
- [ ] Latch **Shift**, then 🎯 a second token: both stay targeted.

### 4. First writes: moving and undoing

⚠️ From here on the world changes.

- [ ] Grab (**✋**) a token, move the pointer, tap **DROP**. The token commits to the new square.
- [ ] Tap **↶**. It goes back. This is the first thing to check on a real instance, because undo has
      never run against anything but a fake.
- [ ] Tap ↶ with nothing to undo. Foundry says so itself and nothing breaks.

### 5. The biggest unknown: sheet creation

⛔ **Before 0.28.0, creating a sheet threw on every real Foundry.** The module called `Actor.create`
detached from `Actor`, and Foundry's `create` begins `this.implementation...`, so every tap produced a
notice and no character. It passed its tests because their stubs never read `this`. Fixed in #353. If
you ever see "Cannot read properties of undefined (reading 'implementation')", an older version is
installed.

✅ **Measured on real pf2e 8.5.0 and Foundry 14.367, 2026-09-13**, in a world holding one party and one
user, with `npm run check:sheets:create`: one tap makes exactly one `character`, it joins the party,
PF2e's `addMembers` takes it out of any folder, and the owner can open it. This section used to say
everything here was read from `sf2e` and should be treated as unverified; that is no longer true for
the GM path. The player path below has still only been tested at the desk.

- [ ] As a GM, **C+** offers the parties you can see, and creating puts a sheet in the chosen one.
- [ ] Check the created actor's **folder** is cleared. Verified live on 2026-09-13; confirm it on your
      instance too, since that was a local world.
- [ ] The sheet is owned by the user chosen, not by the GM who ran it.
- [ ] **C🔓** lists parties and flips one open. The confirmation names the party you tapped.
- [ ] As a player in an opened party, **C+** appears and creating works with a GM online.
- [ ] As a player with **no GM online**, C+ is still there and says a GM has to be online. It should
      never silently do nothing.

## When something fails

Capture these three, in this order. They are the difference between a bug that can be fixed from a
report and one that needs the device back.

1. **🔍**, the diagnose button, which whispers a report to yourself in chat.
2. The console, filtered to `Tongs Browser`.
3. What you did, in taps. "Grabbed, panned, dropped" and "grabbed, dropped" are different bugs.

⚠️ **A passing check on a desktop browser is not the same claim as a passing check on the phone.**
Record which you used, and the Foundry version, next to the result in
[MANUAL-TESTING.md](MANUAL-TESTING.md).

## Known and accepted before you start

Written down so they are not rediscovered as surprises:

- **A GM must be online** for a player to create a sheet. Foundry silently discards an ownership
  entry naming anyone but the creator, so the work has to run on a GM's client.
- **GM map-building keys are unreachable**: cut, copy, paste, send to back, bring to front. All are
  `Ctrl` chords, and the chord mechanism now exists, so they are buildable rather than blocked. See
  `npm run check:keybindings` for the full list of what a phone can and cannot reach.
- **Nothing here has run on physical touch hardware.** Long press timing, vibration and anything
  latency-sensitive are unmeasured.
