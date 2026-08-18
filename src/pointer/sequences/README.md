# src/pointer/sequences

The events each gesture is made of, as **pure data**. Nothing here touches the DOM or constructs an
event; `src/pointer/EventDispatcher.ts` does that, and it is the only place that does.

| File                   | What it is                                              |
| ---------------------- | ------------------------------------------------------- |
| `clickSequence.ts`     | Left, right, and double click                           |
| `dragSequence.ts`      | Press, move, release                                    |
| `moveSequence.ts`      | A bare move, with the hover it implies                  |
| `wheelSequence.ts`     | Zoom                                                    |
| `descriptorFactory.ts` | Building descriptors without retyping the shared fields |

## Why data first

Foundry does not respond to a `click`. It responds to `pointerdown`, `mousedown`, `pointerup`,
`mouseup`, `click`, in that order, with consistent `button` and `buttons` and a `detail` that counts
up. Get one field wrong and nothing happens, silently.

Describing the sequence as data makes it something you can **print and diff** against what a real
mouse produced. That is how several of these were fixed, and it is why the builders are tested
without a browser at all: the interesting failures are in the list, not in the dispatching.

## Targets are symbolic

A descriptor names its target as `'current'` or `'previous'` rather than holding an element, because
these functions are pure and cannot perform a hit test. The dispatcher resolves the names. That is
what lets a move that leaves one element and enters another be expressed as data, and it means a
descriptor whose target resolves to nothing is skipped rather than being an error: the first move of
all has no previous element, and that is ordinary.

## Double click is one sequence, not two clicks

`buildDoubleClickSequence` emits both press-and-release pairs plus the `dblclick`, with `detail`
running 1 then 2. Foundry decides double versus single from its own timing
(`MouseInteractionManager.DOUBLE_CLICK_TIME_MS`, 250ms on 14.366) and the distance from the last
click, so the whole sequence arriving in one tick is well inside both thresholds.

That is worth knowing because it was suspected, at length, of being the cause of a bug that turned
out to be a probe reading the wrong actor. See issue #243.
