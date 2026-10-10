# src/helper

ComeOnOverUno's helper GM. Tongs queues some work for a GM's browser: a new player's sheet, and damage
or spell saves a player rolled while no full GM was online. Lewis, 2026-10-10: he should not have to be on
the world for that work to happen, and @ComeOnOverBot should say what was waiting and on which world.

So when a player's browser queues work with no GM online, it calls ComeOnOverUno with the world id. COO
signs its helper GM in from a hidden browser on the server; Tongs in that browser does the queued work as
any GM's would, and COO posts what was done in the Foundry topic.

| File                 | What it is                                                                |
| -------------------- | ------------------------------------------------------------------------- |
| `startHelperCall.ts` | The player side: call COO when this browser queued work and no GM is here |
| `waitingWork.ts`     | The queued work in words, read by the helper before and after its visit   |

- **The call trusts nothing it sends.** It carries only the world id. The helper acts on the flags it finds
  in the world, so a forged call can at most start one visit, and COO limits how often.
- **One call a minute, and only for this browser's own writes**, so a busy table makes one call.
- **The helper reads `game.modules.get('tongs-browser').helper.waiting()`.** It lists nothing new: it
  reuses the GM-only listings the queues already use, so a player's browser gets an empty list.
