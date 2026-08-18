# src/core

The two things everything else is allowed to depend on.

| File         | What it is                                  |
| ------------ | ------------------------------------------- |
| `Logger.ts`  | Prefixed logging, off unless debug is on    |
| `Vibrate.ts` | Haptic feedback, where the device offers it |

Deliberately tiny. Anything that grows here starts being imported by every other folder, and a
dependency everything shares is a dependency nothing can be tested without.

## Logging is prefixed, and that is load-bearing

Every line starts with `Tongs Browser | `, because a Foundry console is a busy place: a world with a
system and a dozen modules produces plenty of output, and a message you cannot filter for is a
message you will not find. The live checks read the console **filtered by that prefix**, so changing
it silently breaks the harness's ability to see anything the module said.

The startup lines are the ones that matter:

```
Tongs Browser | Initialising Tongs Browser (tongs-browser).
Tongs Browser | Ready. Keyboard strategy: events.
```

## Vibration is best-effort by design

`navigator.vibrate` is absent on desktop, present and ignored in some mobile browsers, and gated
behind a user gesture in others. `Vibrate.ts` treats all three as the same case and never throws,
because haptics failing is not a reason for a gesture to fail.
