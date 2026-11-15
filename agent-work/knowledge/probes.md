# Pack: probes

Read this for every probe step of stage 01: where the indexer is, what its schema offers, how a
probe is written and what its findings file must hold.

## The preprod indexer

- Endpoint: `https://midnight-preprod.blockfrost.io/api/v0?project_id=<id>`, GraphQL over HTTP POST with `content-type: application/json`. The id is the secret `MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID`. [run 6ee55f6]
- `{ block { height hash timestamp } }` answers the head in about 0.3 s. `timestamp` is epoch milliseconds, hashes are lowercase hex with no `0x`. The head was 3434880 when this was written and a block takes about 6 s. [run 6ee55f6]
- `block(offset: BlockOffset)` takes `{ height: Int }` or `{ hash: HexEncoded }`. `Block` also has `parent { hash }` and `transactions`. [run 6ee55f6]
- `contractEvents(filter: ContractEventFilter!, limit: Int, offset: Int)`. The filter fields are `contractAddress` (required), `types`, `fieldPrefixes`, `fromBlock`, `toBlock`, `transactionHash`. [run 6ee55f6]
- A `MiscContractEvent` row has `id`, `maxId`, `transactionId`, `contractAddress`, `name`, `payload`, `raw`, `transaction { id hash block { height hash timestamp } }`. [run 6ee55f6]
- `transactions(offset: TransactionOffset!)` takes `{ hash }` or `{ identifier }` and returns a list. A `Transaction` has `id`, `hash`, `raw`, `block`, `contractActions`. [run 6ee55f6]
- Both `contract(address: HexEncoded!, offset: BlockOffset)` and `contractAction(address: HexEncoded!, offset: ContractActionOffset)` exist. `ContractActionOffset` is `{ blockOffset, transactionOffset }`. [run 6ee55f6]
- The subscription type offers `blocks`, `contractActions` and `contractEvents` among others. No probe needs them: the design polls. [run 6ee55f6]
- The query the SDK sends for events, with its page size of 100 and its end pinned to the first page's `maxId`, is `node_modules/@sig-net/midnight/dist/signet-contract-events.js:108-241`. [read 6ee55f6]
- The contracts to read are the SDK's: `getSignerContractAddress(MidnightNetwork.Preprod)` (`c423fca4...`) and `getResponderContractAddress(MidnightNetwork.Preprod)` (`627ef19b...`) from `@sig-net/midnight`, which loads in plain Node 26. `src/lib/midnight/network.ts:50-55` lists the same two addresses with their deployment blocks, 3386746 and 3386749: the start block of preprod is 3386746. [run 6ee55f6]
- Block 3386746 exists and answers with its hash and its parent's hash in about 0.7 s. [run 6ee55f6]
- Whether the indexer follows finalised blocks only is not known. Its source is the public repository `midnightntwrk/midnight-indexer`. [unverified]

## How a probe is written

- A probe is ONE self-contained file `probes/<name>.mjs`, run by plain `node` with the global `fetch`, importing nothing but `node:` modules and, where the step says so, `@sig-net/midnight`. Two probes never share a helper: they are written side by side and removed in stage 07. [read 6ee55f6]
- It reads the indexer URL from the environment variable `MIDNIGHT_PREPROD_INDEXER_URL` and stops with a message naming the variable when it is unset. It never prints the URL, a response header or an error that could hold the URL. [read 6ee55f6]
- The command that runs one, which keeps the secret out of every output: `MIDNIGHT_PREPROD_INDEXER_URL="https://midnight-preprod.blockfrost.io/api/v0?project_id=$(dev-secrets get MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID)" node probes/<name>.mjs | redact` [run 6ee55f6]
- It prints progress to standard error and writes its findings file itself. With the argument `--verdicts` it writes nothing and prints to standard output one line of JSON: the object of gate id to verdict it computes on this run. The exit check uses that to recompute. [read 6ee55f6]
- The probe files must pass `yarn lint` and `yarn format:check`: an unused variable in a `.mjs` file fails the lint. [run 6ee55f6]
- Keep the load light: at most 5 requests a second, except in the rate limit probe. Every probe shares one project id, and a throttled probe reports a failure that is not the indexer's. [unverified]

## The findings file

`probes/findings/<name>.json`, formatted by `yarn format`, holds exactly:

```
{
  "probe": "<name>",
  "head": <the indexer's head height when the probe started>,
  "gates": {
    "G01": { "verdict": "holds" | "fails" | "not-observed", "evidence": "<one sentence with the numbers>" }
  },
  "numbers": { "<what the stage's gates ask for>": <number> }
}
```

- `holds` and `fails` need an observation that could have come out the other way. A question the probe could not put to the test is `not-observed`, with the reason as evidence. The gate's fallback covers it. [read 6ee55f6]
- The gate ids and what each asks are in the stage's `stage.md`, under Gates. [read 6ee55f6]
- The `SUMMARY` of your report repeats each gate id with its verdict. `FINDINGS` holds what the numbers cannot say: what surprised you, and what the design should do about it. [read 6ee55f6]
