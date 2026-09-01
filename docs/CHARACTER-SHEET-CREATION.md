# Creating character sheets from the control pad

Design notes, 2026-09-01. Requested by Lewis; the three shaping decisions below are his.

## What is being built

1. A control pad button that creates a character sheet, puts it in a chosen **party**, and assigns a
   chosen **user** as its owner.
2. The same button available to **players**, but only able to create inside parties whose GM has
   switched creation on.
3. Nothing in this feature, or anywhere else the module already shows a list, may name a sheet, party
   or folder the current user has no permission to see.

## The decisions taken

| Question                         | Decision                                                      |
| -------------------------------- | ------------------------------------------------------------- |
| Scope of the visibility rule     | The new UI **and** an audit of the module's existing surfaces |
| Where the per-party switch lives | A module **flag on the party actor**                          |
| What a player's tap does         | Creates **immediately**, no GM approval step                  |

## ⚠️ The constraint the whole design turns on

**A player cannot assign ownership.** Ownership lives on the document and only a GM may write it, so
a sheet a player creates cannot be given to anyone by that player, including themselves.

This is not a new discovery in this repo, and the existing note in `foundry/PauseControl.ts` is worth
repeating because it is the trap: the check is on the ACTION, not on permissions, so granting a player
ownership of something does not buy the ability to perform a GM-only operation. `PauseRelay` exists
for exactly this reason, and its docblock records that the obvious workarounds do not work and one of
them "is widely repeated as if it does".

So creation runs on a GM's client, asked for over the socket. That has a consequence worth stating
plainly rather than discovering on a device:

> ⚠️ **A GM must be online for a player to create a sheet.** There is no way around it, and the UI has
> to say so rather than failing silently.

It also has a benefit that falls out for free, and it is the reason this is the right shape rather
than merely the possible one: **players never need Foundry's `ACTOR_CREATE` permission**. Granting
that would let them create actors anywhere, by any route, for the rest of the world's life. Routing
through the relay means the party flag is the _only_ thing that authorises creation, which is exactly
what requirement 2 asks for.

### Reuse, do not copy

`PauseRelay` is single-purpose. The parts worth generalising rather than duplicating:

- **`isDesignatedGm`**, not "am I a GM". Its docblock records why: with three GMs connected, every one
  of them answers the request and the result lands wherever the race leaves it.
  `game.users.activeGM` picks the same single user on every client.
- The narrow `SocketLike` interface, and a payload validator that rejects anything unexpected, so an
  older client cannot be confused by a newer field.

## Verification reality on this machine

⚠️ **The PF2e system is not installed here.** `Data/systems` holds `coo`, `sf2e` and `worldbuilding`.

`sf2e` (Starfinder 2e 1.4.0) is built on the PF2e codebase and **does declare a `party` actor type**,
so it is a usable proxy for the party half of this work. It is a proxy and not the thing itself:
anything measured against `sf2e` must be re-measured on `pf2e` before this is called done.

The permission half is Foundry core, not system code, and can be measured on any world.
`scripts/foundry-permissions-probe.ts` asks 14.366 directly about ownership levels, which roles hold
`ACTOR_CREATE`, whether a named player may create an actor, and whether that player may write an
`ownership` field. It creates nothing.

## Proposed slices

Each is separately shippable and separately testable, and none is useful without the one before it.

1. **Measure.** Run the permissions probe; record the answers here with a date. Confirm on `sf2e` how
   a party actor stores its members, and how an actor is added to one.
2. **The visibility audit** (requirement 3). Before adding a picker, find out what the module's
   existing pickers show. This is deliberately first: it is the requirement most likely to be
   quietly violated by the new UI, and knowing the existing answer sets the standard.
3. **GM-only creation.** The button, a party picker, a user picker, and creation performed locally
   because a GM is already allowed to do all of it. No socket traffic yet.
4. **The party flag.** A GM-only switch per party, and the plumbing to read it.
5. **Player creation over the relay.** The generalised request/response, `isDesignatedGm`, and the
   "no GM online" state in the UI.

Slice 3 is the first one with visible value, and slices 1 and 2 are what stop it being built on
guesses.
