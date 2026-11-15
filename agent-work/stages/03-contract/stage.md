# Stage 03-contract

## Delivers

Every interface the two halves meet at, with a fake behind each, so that stage 04 builds the
backend and the UI side by side: `packages/lib` (domain code both runtimes use), `packages/api`
(resources, service interfaces, the HTTP contract and in-memory services), and in
`packages/backend` the database schema with its one migration, the chain source interface with a
scriptable fake, and the repository interfaces. No ingester, no service implementation, no HTTP
host, no UI change beyond imports.

## Assumes

- Stage 02: the workspace, the backend package, the Postgres harness, all dependencies present.
- G01, G02 (stage 01): how `block_position` is assigned and what a range's bounds mean. They
  shape `ChainSignetEvent` and `BlockRange`.
- G11 (stage 01): the two JSON shapes a trace can be stored in.
- D02: the API carries raw facts and no verdict. D14: resources are keyed by chain keys.
  D21: no URL in any reply. D25: the three entries of `@explorer/api`.

## Shape

03.1 then 03.2 in a chain: `api` is written in `lib`'s vocabulary, and both change the lockfile.
Then three side by side, each in its own files: 03.3 (`packages/api/src/http.ts` and
`src/http/`), 03.4 (`packages/api/src/fakes.ts` and `src/fakes/`), 03.5 (`packages/backend`, the only one of the three that changes
`yarn.lock`). 03.6 reviews the whole contract last: an error here is paid for by every step of
stage 04.

Conventions fixed here, which the steps follow:

- One folder per resource in `packages/api/src/`: `network/`, `sign-request/`,
  `midnight-transaction/`, `ethereum-transaction-output/`. In each: `<resource>.ts` (zod schema
  and type) and `<resource>-service.ts` (interface, args schemas, reply types). The transport
  is in `src/http/` (`<resource>-service-adaptor.ts`, `<resource>-http-client.ts`) and the
  in-memory services in `src/fakes/` (`<resource>-service-fake.ts`), one file per service.
- A route is `POST /<folder name>/<method name as in the interface>`, for example
  `/sign-request/listSignRequests`.
- On the wire: bytes are lowercase hex with no `0x`, times ISO 8601 in UTC, block heights and
  positions JSON numbers, and any other 64-bit value a decimal string.
- The rule that turns a request's events into its row is ONE pure function in `api`,
  `deriveSignRequest`. The backend's incremental update and the fake both answer to it.

## Gates

| Gate | Question | Answered by | Outcome and fallback |
| --- | --- | --- | --- |
| G15 | Does the list need a value that is not a column of the aggregate table (architecture, 4.4)? The census in the `ui-census` pack says a request with several notifications shows every time and every caller today, and search and exclusion match any of its callers | 03.2, in its report, under a line starting `CENSUS:` | Prepared answer: the row shows the first notification's time and caller with a count of the others, and search and exclusion match the first caller. If 03.2 finds a filter cannot be answered from first values, it adds the columns to the resource and says so. The orchestrator records the outcome in `decisions.md`, repairs step 03.5 to match before dispatching it, and lists the change for the user |
| G16 | Which value is the `trace` column: the call frame as the node served it, or the SDK's decoded output? | 03.2, from `probes/findings/evm-trace.json` | Prepared answer: the frame as served, because the backend serves facts and the SDK's reading of a frame is the UI's check. If the frame is not plain JSON or is too large to store: the decoded output, with the reason recorded |
| G17 | Does the review find the contract other than the design says? | 03.6 | `blocking` findings get one fix step each and ONE further review of the fixes alone. `advisory` findings are listed for the user and fixed in at most one step, with no review after it |
