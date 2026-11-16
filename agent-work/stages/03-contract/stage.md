# Stage 03-contract

## Delivers

The two contracts every builder of stage 4 works against, each with a fake: the HTTP contract in `packages/api` (wire schemas, client, routes, an in-memory service) and the storage contract in `packages/backend` (migrations, table types, the `lifecycle` view, the source port with an in-memory source). A review of both.

## Assumes

- Stage 2 delivered the workspaces, the dependencies and `@sig-net/explorer-lib` with `StoredSignetMiscEvent`, `SignetContractEvent`, `SignBidirectionalLifecycle`, `aggregateSignBidirectionalLifecycles`, `MIDNIGHT_NETWORKS` and the contract address parsers.
- Stage 1's gates left the indexer adaptor as the source (D08). A gate that stopped at "bring it to the user" changes this stage.
- D05, D06, D07, D11, D13, D15, D18 to D20 and D23 of `decisions.md`.

## Shape

03.1, then 03.2, then 03.3. The view of 03.2 returns rows in the wire shape 03.1 defines, and the review reads both. Step 03.2's check starts a PostgreSQL container.

## Gates

- **Review 03.3.** A `blocking` finding gets a fix step (`agent-work new-step 3 ...`, on fable, scoped to the files the finding names) and then ONE further review of the fixes alone. `advisory` findings are listed for the user in the closing report and fixed in at most one step with no review after it. This stage has at most two reviews.
- **Can the request record cross the wire as the cell the transcript wrote?** Step 03.1 tests it with the fixture. If the round trip is lossless the client decodes the cell with the SDK. If not, 03.1 writes a field by field codec of `SignBidirectionalEvent` instead and says so in its report, and step 04.6 reads the record from that codec.
