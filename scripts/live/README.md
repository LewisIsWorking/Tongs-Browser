# scripts/live

The broad "is anything obviously wrong" pass, run by `npm run check:foundry`.

| File                    | What it is                                                 |
| ----------------------- | ---------------------------------------------------------- |
| `chromeChecks.ts`       | Foundry's own interface still responds to us               |
| `sceneControlChecks.ts` | The module's toggle is registered, rendered, and reachable |
| `recorder.ts`           | Collecting results and page errors into one report         |

## Registered, rendered, reachable

`sceneControlChecks.ts` asserts those three separately, and the separation is the point. A toggle
that is registered but never rendered looks exactly like one that does not exist. A toggle rendered
underneath the modifier bar looks exactly like one that ignores taps. Collapsing them into "the
toggle works" produces a green check for two distinct broken states.

The reachability assertion names the **topmost element at the toggle's centre**, so a failure says
what is in the way rather than that something is.

## It also toggles, and toggles back

Asserting that the control exists proves a menu entry. Asserting `enabled true -> false -> true`
proves it is wired to something, and that the wiring survives being used. An advertised command that
is not registered anywhere is one of this project's recurring failure shapes.

## Page errors are a result, not noise

`recorder.ts` collects `pageerror` and console errors and reports "no page errors from the module" as
its own line. A check suite that only asserts its own expectations will happily pass while the module
throws on every frame, because nothing asked.
