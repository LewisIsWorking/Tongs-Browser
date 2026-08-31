---
'tongs-browser': patch
---

Make `describeCallSite` testable, and test what it does with an unexpected stack.

It read its own stack, which left every fallback unreachable from a test: an absent stack, a frame the
pattern cannot parse, and a stack with no foreign frames at all. The stack is now a defaulted
parameter, so production is unchanged and the parsing is a pure function of its input.

Those fallbacks are worth pinning because this function has already spent two releases reporting
nothing useful. It filtered by source file name, and after bundling no stack contains one, so the
filter matched nothing and it reported `at describeCallSite` - itself. It answered every time, so
nothing looked broken, and the answer was always the same useless one.

Mutation checked: removing the bundle filter, narrowing to one frame, dropping the unknown-caller
fallback, or discarding an unparseable frame each fails.

`DragCallSite` goes 70% to 90.9% of branches and 100% of statements; project branches to 96.51.
