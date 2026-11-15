# Stage 04-build

## Delivers

The two halves, each complete behind the contract and neither yet joined to the other. Backend:
the indexer chain source, the repositories and the unit of work, the ingester, the configuration
and the four service implementations, all tested against the fake chain source and a real
Postgres. UI: the whole explorer page reading the `@explorer/api` services, tested against the
in-memory fakes. No HTTP host and no process to start: stage 05 joins them.

## Assumes

- Stage 03: the contract and its fakes, reviewed. Its conventions hold here.
- G03, G04, G05, G07 (stage 01): the defaults of `SAFETY_MARGIN`, `RANGE_SIZE`, `REREAD_BLOCKS`
  and `POLL_INTERVAL`, and whether a range needs two walks. G06, G08, G09: the queries behind
  `blockAt`, `rawTransaction` and `contractExistsAt`.
- G15 (stage 03): what a list row holds.
- D30: the UI's tests inject the fakes, and no fake is reachable from the production bundle.
- The old way the UI reads events keeps working until stage 05 removes it: this stage adds
  beside it and moves consumers over.

## Shape

Two tracks that never share a path, so all of it runs as wide as its waits allow.

Backend, each step in its own folder of `packages/backend/src/`:
04.1 (`chain-source/indexer/`), 04.2 (`repositories/sql/`, `sign-requests/`) and 04.4
(`config/`) start at once. 04.3 (`ingester/`), 04.5 (`services/network/`,
`services/sign-request/`) and 04.6 (`services/midnight-transaction/`,
`services/ethereum-transaction-output/`, `evm/`) wait on 04.2, whose repositories they use.
04.11 reviews ingestion and storage when 04.1, 04.2 and 04.3 are merged: an error there is a
lost event.

UI, in `packages/ui/`: 04.7 first (the client, polling, and the split of the table's file that
lets the next three work apart). Then 04.9 (the expanded row) and 04.10 (the configuration
popover and the status line) side by side, each on its own files, and 04.8 (the list) after
04.9, because the list mounts the expanded row and no stand-in for it is ever merged. 04.7 is the only
step of the stage that changes `yarn.lock`.

## Gates

| Gate | Question | Answered by | Outcome and fallback |
| --- | --- | --- | --- |
| G18 | Does the chain source read events through the SDK's `signetEventSourceFromIndexer`, or through its own query? | 04.1, from the numbers of stage 01 | Prepared answer: through the SDK's reader, wrapped in the checks of section 5, so that one definition turns an indexer row into an event. Its own query only if stage 01 showed events that are not `Misc` (`rows_not_misc` above 0), a page size the SDK's fixed 100 cannot serve, or an order the reader cannot guarantee. Then the duplicated row reading says at its definition why it exists and when it goes |
| G19 | Does the review find ingestion or storage other than the design says? | 04.11 | `blocking` findings get one fix step each and ONE further review of the fixes alone. `advisory` findings are listed for the user and fixed in at most one step, with no review after it |
