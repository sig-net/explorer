# Stage 03-contract

## Delivers

The two contracts every builder of stage 4 works against, each with a fake: the HTTP contract in `packages/api` (wire schemas, client, routes, an in-memory service) and the storage contract in `packages/backend` (migrations, table types, the `lifecycle` view, the source port with an in-memory source). A review of both.

## Assumes

Each line was checked by a command at `c09a270` when this stage was revised.

- Stage 2 delivered the four workspaces with their dependencies installed (`hono`, `zod`, `kysely`, `pg` import from `packages/backend`), and `@sig-net/explorer-lib` with `StoredSignetMiscEvent`, `SignetContractEvent`, `decodeSignetContractEvent`, `SignBidirectionalLifecycle`, `aggregateSignBidirectionalLifecycles`, `MIDNIGHT_NETWORKS` and the contract address parsers. `packages/api/src/index.ts` and `packages/backend/src/index.ts` are empty modules.
- No step of this stage adds a dependency, so `yarn.lock` and the manifests of the other workspaces stay as they are. A step that finds it needs one stops and reports it.
- No step of this stage changes a type the UI reads, and none moves a test. The UI compiles and its 130 tests pass before and after, which every step's check sees through the repository checks.
- Stage 1's gates left the indexer adaptor as the source (D08).
- D05, D06, D07, D11, D13, D15, D18 to D20, D23, D33 and D34 of `decisions.md`.

## Shape

03.1, then 03.2, then 03.3: a chain. After the review: 03.4 (the fix of its two blocking findings), then 03.5 (its advisory fixes) beside 03.6 (the review of 03.4 alone). The view of 03.2 returns events in the wire shape 03.1 defines, and the review reads both.

What one step's check starts: 03.1 the repository's checks (install, lint, typecheck, the UI's tests in a Chromium, the build: about 20 s) and the api package's tests under Node. 03.2 the same with one PostgreSQL 17 container. 03.3 nothing in its check, and during its work one PostgreSQL container that the reviewer seeds with 200,000 requests. The stage check starts two PostgreSQL containers and runs the repository's checks twice.

## Gates

- **Review 03.3.** A `blocking` finding gets a fix step (`agent-work new-step 3 ...`, on fable, scoped to the files the finding names) and then ONE further review of the fixes alone. `advisory` findings are listed for the user in the closing report and fixed in at most one step with no review after it. This stage has at most two reviews.
- **Can the request record cross the wire as the cell the transcript wrote?** Answered before dispatch, by `agent-work/probes/request-cell-wire.mjs` on the preprod fixture transaction: the round trip is lossless (D33). The client decodes the cell with the SDK and no field by field codec is written.
