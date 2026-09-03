# src/relay

Asking a GM to do something the asker is not allowed to do.

| File                 | What it is                                                          |
| -------------------- | ------------------------------------------------------------------- |
| `PauseRelay.ts`      | A player asks a GM to pause or unpause the game                     |
| `CreationRequest.ts` | The wire shape of "please make me a character sheet", and its check |
| `CreationPolicy.ts`  | What a GM's client will and will not honour                         |

## Why a relay is needed at all

Foundry puts its permission checks on the **action**, not on ownership, so being given ownership of
something does not buy the ability to perform a GM-only operation on it. `PauseRelay`'s docblock
records the measured details, including that the obvious workaround "run a macro as GM" does not
exist in core Foundry and yet is widely repeated as if it does.

Sheet creation has the same shape, and worse: measured from Foundry 14.366's own
`sanitizeDocumentOwnershipField`, a player creating a document with ownership for somebody else has
that entry **silently deleted**. No error. The sheet exists, the player owns it, and the person it
was for simply does not. That is the feature's central operation failing in the one way nothing
reports, which is what makes the relay necessary rather than merely tidy.

## ⚠️ The inversion that makes `CreationPolicy` the important file

Everywhere else in this module, our checks sit in front of Foundry's own enforcement, so a gap means
Foundry still refuses. On the relay's receiving end that is **backwards**: the code runs on a GM's
client, and a GM may do anything. The rule that stops a player granting ownership elsewhere is simply
absent there.

So the relay does not run the player's request as a GM. It decides, from the GM's own view of the
world, what the player was entitled to ask for, and does that. In particular the party's
"open to players" flag is re-read from the GM's copy and never taken from the payload: a request that
carried its own permission would be a request that granted itself.

## ⚠️ The known weakness: `userId` is claimed, not proven

Core Foundry rebroadcasts a socket payload without attaching a verified sender, so the receiving
client cannot tell who really emitted a message. A player can therefore name another player's id and
have a sheet created owned by that person.

It is bounded: it only works in a party a GM has already opened to players, it creates an ordinary
character there, and it must name a real user. The damage is a misattributed sheet in a party where
sheets were invited, not access to anything hidden. It is recorded here rather than left implicit
because it is a genuine limitation of the transport, not of this code, and closing it would mean
taking a dependency such as socketlib.

## Why it is its own folder

It is the only part of the module that reacts to something **another user** did; everything else
responds to the local person's fingers. The original note here predicted that "if a second such relay
ever appears it has an obvious home", which is exactly what happened on 2026-09-03.
