# src/encounter

Foundry encounters kept in step with the Path Wars campaign's Telegram combat topic. The active full GM's
browser posts each encounter to ComeOnOverUno, which keeps one tracker message per encounter edited in place
and holds the encounter for the Nudge bot, which does the pinging. Off until a GM turns it on.

| File                    | What it is                                                                  |
| ----------------------- | --------------------------------------------------------------------------- |
| `encounterSnapshot.ts`  | A Foundry combat read into allies and enemies, who has acted, and players   |
| `EncounterSync.ts`      | Posting on change: coalesced bursts, ended at once, the tracker id kept     |
| `playerLinks.ts`        | The GM menu linking each Foundry player user to a Path Wars Telegram player |
| `startEncounterSync.ts` | The setting, init registration, and which Foundry hooks count as a change   |

## Decided with Lewis, 2026-09-15 and 2026-09-16

- **Side phases**, as Lewis's own posts run them: "Round N: Unacted Allies", numbered, each player named;
  once every ally's turn has passed it is the enemies' phase. ComeOnOverUno renders the text.
- **Foundry drives the bot.** The tracker message is edited in place, which never notifies anyone; the bot
  reads the encounter from ComeOnOverUno and pings at phase start and every few hours.
- **Players are linked per Foundry user**, chosen from the bot's own roster, and every character they own
  follows.

## Learnings

- ⚠️ **Acted means the turn pointer has passed.** Foundry keeps no "has acted" flag; a combatant before
  `combat.turn` in the current round has had its turn, and before round 1 nobody has.
- ⛔ **The tracker id lives on the Foundry combat, as a flag.** ComeOnOverUno keeps encounters in memory
  only, so the id is sent back every time and a server restart still edits the same message. Writing that
  flag is itself an `updateCombat`, so only round, turn, active and started changes count.
