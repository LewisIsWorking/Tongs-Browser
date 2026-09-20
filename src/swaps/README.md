# src/swaps

The GM's half of Foundry world swapping. One server runs one world at a time, so a player pressing Play in
ComeOnOverUno for a campaign in a different world has to take the server. COO asks a connected GM first, and it
only knows a GM is connected because this heartbeat says so. Without it, every swap takes the "no GM
connected" path and simply happens.

| File                 | What it is                                                                        |
| -------------------- | --------------------------------------------------------------------------------- |
| `WorldSwapGm.ts`     | One heartbeat: report the world, prompt once per waiting request, send the answer |
| `startWorldSwaps.ts` | The setting, the 30s timer, the Foundry dialog, and the GM check                  |

## Decided with Lewis, 2026-09-17

- **A connected GM is asked; with no GM connected the swap just happens.** That is the rule this code
  exists to make true.
- **The Play button lives in ComeOnOverUno**, so the player side never touches Foundry directly.

## Learnings

- ⚠️ **The heartbeat is the answer channel too.** `POST api/foundry/presence` returns the requests waiting
  on this world, so there is one call on a timer rather than a heartbeat plus a poll.
- ⚠️ **30s beats against COO's 75s presence window**, so two lost beats still leave the GM counted as
  present. A request waits 2 minutes (`SwapRequestLifetime`): four beats to notice and answer.
- ⛔ **One prompt per request, ever.** COO keeps reporting a request until it is decided, and briefly after,
  so ids already seen are remembered including past the answer. Otherwise dialogs stack over the table.
- ⛔ **Only the active full GM's browser beats.** `automationRole` names exactly one browser; an Assistant
  GM or a second GM tab would otherwise each open the same dialog and race to answer it.
- ⚠️ **A failed decision is forgotten on purpose**, so the next heartbeat asks again and the GM sees a
  warning. That is better than a request expiring while they believe they answered it.
- ⚠️ **On by default**, unlike the other automations. Off is the dangerous setting here: it does not stop
  Tongs doing something, it stops COO asking before it closes the world the table is playing in. Nothing is
  sent until the GM signs this browser in to COO.
- ⛔ **The requester's name is escaped into the dialog.** It is a Foundry user name COO derived from a COO
  username, which the player chose.
