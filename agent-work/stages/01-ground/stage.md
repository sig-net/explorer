# Stage 01-ground

## Delivers

An answer, from something that was run, to each of the eleven assumptions of `architecture.md`,
and proof that a subagent of each model the plan uses follows a brief, commits on its own branch
and files a report. The answers are `agent-work/probes/findings/*.json`, beside the probes in
`agent-work/probes/`, where a doubted answer can be run again. Every such path is relative to the
root of the worktree a step works in. No product code: nothing under `src/`, no manifest, no
lockfile.

## Assumes

- The secrets `MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID` and `SEPOLIA_FORK_RPC_URL` work.
- Docker runs on this machine (step 01.8 runs a `node:24.18.0-bookworm-slim` container).
- D17: preprod is the one network probed.
- D35: no step changes a file under `.github/workflows`, and nothing is pushed outside the
  task's branches.

## Shape

01.1, 01.2 and 01.3 are trivial and run side by side, one per model: they prove the machinery,
and every probe waits on all three. The probes 01.4, 01.5, 01.6, 01.8 and 01.9 then run
side by side: each writes its own files. 01.7 measures the indexer's rate limit with the one
project id every probe shares, so it waits on 01.4, 01.5 and 01.6 and runs alone.

## Gates

The orchestrator reads each verdict, records it in `decisions.md` as `orchestrator` with the
fallback it triggers, and the planner who revises stage 02 onwards writes the consequences into
`architecture.md`, the packs and the later stages. A fallback that says BLOCKED stops the task:
the user decides.

| Gate | Question | Answered by | holds | fails or not-observed |
| --- | --- | --- | --- | --- |
| G01 | Do `contractEvents` rows come in strictly ascending `id`, on one page and across pages? | 01.4 | `block_position` is the rank by ascending `id` in the block, as designed | `eventsInRange` sorts by `id` itself and still refuses a duplicate. If `id` does not follow emission order at all: BLOCKED |
| G02 | Are `fromBlock` and `toBlock` inclusive at both ends? | 01.4 | Ranges as designed | The chain source widens the range by one block at the exclusive end and filters by height itself |
| G03 | Does an offset walk of a closed range below the head return the same rows while the chain advances? | 01.5 | Paging as designed | A range is read twice and accepted only when both walks are identical, and `RANGE_SIZE` is set so that one page holds a range |
| G04 | When the indexer reports head H, does it already serve every event of every block up to H? | 01.5 | `SAFETY_MARGIN` defaults to the lag observed plus 2 blocks | `SAFETY_MARGIN` defaults to at least 10 blocks and twice the largest lag seen, `REREAD_BLOCKS` to twice the margin |
| G05 | Is a block at or below the reported head never replaced? | 01.5 | The hash check stays as the detector | `SAFETY_MARGIN` covers the deepest replacement seen plus the chain's finality depth, and the hash check halts the network |
| G06 | Does `block(offset: { height })` give the hash of any past height, and how fast? | 01.6 | `blockAt` as designed | `blockAt` is built from the query that does answer (by hash, or from the events' own block). If no query gives a past block's hash: BLOCKED |
| G07 | What is the largest `limit` honoured, and what request rate does the indexer allow? | 01.4, 01.7 | `RANGE_SIZE`, the page size and `POLL_INTERVAL` take their defaults from the numbers | The same, with pacing in the chain source. If catching up from the start block needs more than 100000 requests: BLOCKED with the number |
| G08 | Does `transactions(offset: { hash })` return the raw bytes of an old transaction? | 01.6 | The Midnight transaction service as designed | The service answers `ok: false` for what the indexer no longer serves, as the UI's loader does today |
| G09 | Does `contract(address, offset: { height })` say cleanly that a contract does not exist below its deployment block? | 01.6 | `contractExistsAt` as designed | `contractExistsAt` asks `contractEvents` for one event at or below the height. If neither works: BLOCKED |
| G10 | Does Node 24.18 run TypeScript that imports another workspace package's TypeScript source and the SDK, with no build step? | 01.8 | The backend starts with `node src/main.ts` | Source imports fail: the packages are run through `tsx`, added in stage 02. The SDK does not load in Node: BLOCKED |
| G11 | Does `debug_traceTransaction` answer from `SEPOLIA_FORK_RPC_URL`, and does the SDK decode the frame in Node? | 01.9 | The trace service as designed, and stage 03 has the two JSON shapes to choose from | The node refuses the method: the service answers `ok: false` and the user is told what the endpoint lacks. The SDK cannot decode in Node: BLOCKED |
