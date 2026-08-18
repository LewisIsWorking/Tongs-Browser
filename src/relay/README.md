# src/relay

| File            | What it is                                        |
| --------------- | ------------------------------------------------- |
| `PauseRelay.ts` | Reflecting Foundry's paused state onto the module |

Foundry's pause is global and can be changed by anyone at the table, so the module cannot simply read
it once at startup. `PauseRelay.ts` watches for the change and relays it, which is why this is a relay
rather than a getter.

## Why it is its own folder

It is the only piece of the module that reacts to something **another user** did. Everything else
responds to the local person's fingers. Keeping it separate means that distinction stays visible, and
if a second such relay ever appears it has an obvious home rather than being absorbed into whichever
folder happened to need it first.
