---
'tongs-browser': patch
---

Fix creating a character sheet, which had never worked in a real Foundry, and the diagnostics button,
which had the same bug.

**Creating a sheet threw on every real Foundry.** The module took `create` off `Actor` and called it
bare. Foundry's `Document.create` is a static method that begins
`this.implementation.createDocuments(...)`, so a detached call left `this` undefined and threw
"Cannot read properties of undefined (reading 'implementation')". The module caught that and reported
it, so a tap produced a notice and no character. It is now called on `Actor`.

It passed every test because every stub was an arrow function or a `vi.fn`, neither of which reads
`this`. The test file had even written down the gap it could not close: "MISSES: whether Foundry
accepts the document. Only the live harness can say." It was found by the first live press of the
create button against real PF2e.

**Whispering a diagnostic report was broken the same way.** `createChatMessage` was
`globals.ChatMessage?.create`, detached, and `ChatMessage` inherits the same `Document.create`. That
line sat directly above the fix for `notify` (#347), which bound that port and explained in its
comment exactly why a detached method is dangerous. It is now bound too.

It survived that fix because its test asserted `expect(targets.createChatMessage).toBe(create)`. An
identity check. `.bind` returns a new function, so the correct fix would have turned that assertion
red, and the very next line of the test was #347's comment saying an identity check "protected the
bug". Both identity assertions now check that the call arrives instead.

**New: `npm run check:sheets:create`.** It presses create for real in a PF2e world, judges the sheet
it made, and deletes it. It is separate from `check:sheets`, which promises to write nothing and still
does. Verified against PF2e 8.5.0 on Foundry 14.367: one tap makes exactly one `character`, it joins
the party, the owner can open it, and PF2e's `addMembers` takes it out of any folder.

That last one had only ever been read in PF2e's source. It has now been watched on a real actor, and
the check refuses to pass it for a sheet that never joined, because a new actor has no folder anyway
and a null folder there would prove nothing. The first live run printed exactly that coincidental
PASS, beside a party-membership failure that turned out to be the check reading members before the
second write had landed.

The check finds what to delete by diffing actor ids before and after the press, never by name, so it
cannot remove a real character that shares the default name, and cleans up in `finally` so a failed
run leaves nothing behind.
