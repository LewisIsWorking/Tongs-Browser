# 4. Foundry honours synthetic keyboard events, measured on 14.365

Date: 2026-08-09

Status: Accepted

## Context

This was the largest open risk in the module, and it was unanswerable in the environment the code was
written in. `KeyboardSynthesizer`'s own class comment states it plainly:

> This is the module's biggest open risk, and it is genuinely unknowable without a running Foundry.

The problem is not whether a `KeyboardEvent` can be dispatched. It is that Foundry's `KeyboardManager`
keeps its own `downKeys` set, and a great deal of core and system code asks that set rather than
reading the event it was handed. Browsers stamp `isTrusted: false` on any event constructed in
script. If Foundry declines to update `downKeys` from an untrusted event, every synthesised modifier
is invisible no matter how correctly the event is built, and the modifier bar is dead in a way that
produces no error and no console output.

Rather than guess, the module measures the answer at startup and adapts, logging the result at
`ready`. Until now nobody had read that line.

## Measurement

Taken 2026-08-09 against a real Foundry, not a stub, using `npm run probe:foundry`.

|         |                                                             |
| ------- | ----------------------------------------------------------- |
| Foundry | 14.365, headless Node server, local                         |
| System  | `coo` 0.60.1, world `cootestworld`                          |
| Browser | Chrome, headless, driven by Playwright                      |
| Module  | `tongs-browser` 0.1.0, loaded from a symlinked working copy |

```json
{
  "reported": { "strategy": "events" },
  "measured": { "isTrusted": false, "honoured": true, "strategy": "events", "downKeysType": "Set" }
}
```

```
Tongs Browser | Foundry honours synthesised keyboard events.
Tongs Browser | Ready. Keyboard strategy: events.
```

**Two independent measurements, deliberately.** `reported` is the module quoting its own probe, which
proves only that it is self consistent. `measured` is the probe script constructing its own
`KeyboardEvent`, dispatching it on `document` and reading `game.keyboard.downKeys` itself, with no
involvement from the module. A readout derived from its own source cannot check that source, so the
script compares the two and exits non zero if they ever disagree. They agree.

`isTrusted: false` is recorded because it is the whole point. Without it the measurement would be
consistent with having accidentally sent a real keypress, and would prove nothing.

## Decision

Treat `events` as the expected strategy on Foundry 14. Keep the `direct` fallback.

## Consequences

**The modifier bar works as designed on this build.** No fallback, no reaching into Foundry
internals, no version fragility from that direction.

**`applyDirectFallback` is dead code on 14.365**, and is kept anyway. It costs a branch that is never
taken, and the alternative is having no answer at all on the first build that changes its mind. It
announces itself loudly when it does engage, so a future regression will be visible rather than
silent.

**The worst branch of `unknown` is ruled out.** `downKeys` still exists under that name and is still a
`Set`, so even if a later build stops honouring events, the fallback has something real to write to.
That was the genuinely dangerous possibility: `unknown` caused by a renamed API would have meant both
paths were broken at once.

**This says nothing about Android.** `isTrusted` is false for script constructed events in every
browser, and Foundry's `KeyboardManager` is the same code on a tablet, so the result is expected to
carry. Expected is not measured. The device checklist still asks for the line.

## How to re run it

```
npm run probe:foundry
```

Needs a Foundry running with a world launched. Targets `http://localhost:30000` unless `FOUNDRY_URL`
says otherwise, joins as `Gamemaster` unless `FOUNDRY_USER` says otherwise, enables the module if it
is off, and prints the block above. Set `PLAYWRIGHT_CHANNEL=chrome` to drive the installed Chrome
rather than a downloaded Chromium.

The approach is borrowed from `ComeOnOverFoundry/tools/foundry-session.ts`, which had already paid for
the three things that make it reliable: posting the join rather than driving the form, waiting on
`game.ready` rather than a selector, and a viewport of at least 1366x768.
