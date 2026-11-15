# Stage 06-operations

## Delivers

What an operator needs when something goes wrong or changes: the audit that walks the whole
history again and compares it with what is stored, the explicit commands (wipe, reset one
network), and drills that kill and confuse real backend processes and show the guarantees hold
outside unit tests.

## Assumes

- Stage 05: the backend runs as a process with a command table holding `start` and `migrate`,
  and G20 held on preprod.
- D05, D06, D07: one deployment per network, no migrations, and a wipe that is always an
  explicit command.
- Section 9 of the architecture is the specification of every command here.

## Shape

A chain, because each step adds to the command table in `packages/backend/src/commands/` and to
`package.json`: 06.1 (the audit), then 06.2 (wipe and reset), then 06.3 (the drills, which use
every command), then 06.4 (the review). Nothing here touches `packages/ui`.

## Gates

| Gate | Question | Answered by | Outcome and fallback |
| --- | --- | --- | --- |
| G23 | Does the audit, run over the whole of preprod's history, agree with what the ingester stored? | 06.1, by its opt-in test | Yes: as planned. No: the same as G20 failing: the task STOPS, the difference is recorded, and the planner re-plans from it |
| G24 | Does every drill end in the state the design promises (no duplicate, no gap, a halt that is visible)? | 06.3 | Yes: as planned. A drill that ends otherwise is a `blocking` finding against the step that built the part, fixed before the review |
| G25 | Does the review find the operations other than the design says? | 06.4 | `blocking` findings get one fix step each and ONE further review of the fixes alone. `advisory` findings are listed for the user and fixed in at most one step, with no review after it |
