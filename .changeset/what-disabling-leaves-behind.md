---
'tongs-browser': patch
---

Switching the module off has ordering rules, and now they are asserted.

Disabling is not "stop listening". Foundry keeps whatever state the module put it in, so a drag in
progress, a latched modifier and a scaled interface all outlive the module unless teardown deals with
them. Each is invisible afterwards, because the module is off and there is nothing left to blame.

Now covered: a drag in progress is abandoned rather than left with Foundry believing a button is
still held, and the interface is given back by removing the scale property rather than overriding it
with a 1 that merely looks the same. Both fail when broken.

⚠️ Removing `disable`'s early return fails nothing, and that is recorded in the test rather than
chased. Every teardown step is already idempotent, so the guard changes nothing observable: an
equivalent mutant rather than a hole. The test beside it still earns its place, because it fails if
`disable` stops clearing its own flag, which would leave the module unable to be switched back on.

`TongsBrowser.ts` 82.5% to 84.2% statements and 75% to 83.3% of branches; the project reaches 95.7%.
