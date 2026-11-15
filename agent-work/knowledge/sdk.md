# Pack: sdk

Read this before touching Signet events: reading them, decoding them, storing them or sending
them over the API. Everything is in `node_modules/@sig-net/midnight/dist/`, and every name below
is exported from the package root.

## Events

- A Signet contract emits one kind of contract event, a `Misc` event: a 32-byte name and a 256-byte payload. The three names are the enum `SignetEventName`: `SignBidirectionalEvent`, `SignatureRespondedEvent`, `RespondBidirectionalEvent` (`signet-contract-events.d.ts:9-16`). [read 6ee55f6]
- `SignetMiscEvent` is `{ name: string, payload: Uint8Array }`: the name with its NUL padding stripped, the payload padded back to 256 bytes (`:26-31`). The indexer trims a payload's trailing zeros, and the SDK pads it again (`signet-contract-events.js:151-152`). Store the padded form: it is what "as the SDK normalises it" means in the architecture. [read 6ee55f6]
- `IndexedSignetMiscEvent` adds `id`, `maxId`, `transactionId`, `transactionHash`, `blockHeight`, `blockHash` and `blockTimestamp` (a `Date`) (`:40-55`). `id` is the indexer's own cursor and `transactionId` its own row id: neither is a chain fact. [read 6ee55f6]
- `tryDecodeSignetEvent(event)` returns `undefined` for a name that is not a Signet name, `{ ok: true, event }` for a decoded event and `{ ok: false, source, reason }` for a Signet name whose payload does not decode (`:401-423`). `decodeSignetEvent` THROWS on input anyone can put on chain: never use it on a stream. [read 6ee55f6]
- A decoded event is `{ name, requestId, record, source }`, a union discriminated on `name` (`:353-366`). `requestId` is a `RequestIdHex`: lowercase hex, no `0x`. It is DECLARED by the emitter and proves nothing. [read 6ee55f6]
- The record of a `SignBidirectionalEvent` is `SignBidirectionalNotification`: `{ version: 1, callerAddress, requestsPath }`, the caller as 64 lowercase hex digits (`:290-313`). The other two records hold `Uint8Array` and `bigint` fields (`:176-227`), which JSON cannot carry: the API sends the raw payload, and the browser decodes. [read 6ee55f6]
- The app's own wrapper is `decodeSignetContractEvent(source, roles)` in `src/lib/midnight/signet-events.ts:35-46`: it adds the emitter's roles and turns the two failures into the variants `unrecognised` and `undecodable`. These are the three `kind` values of the events table. [read 6ee55f6]

## Reading the indexer

- `signetEventSourceFromIndexer({ queryUrl }).streamSignetEvents(address, { fromBlock, toBlock })` yields `IndexedSignetMiscEvent`s oldest first, 100 a page by `offset`, both bounds inclusive by its own documentation (`signet-contract-events.d.ts:57-70`, `.js:220-241`). [read 6ee55f6]
- It asks for `types: ["MISC"]` only (`.js:185`), drops rows above the first page's `maxId`, and checks nothing about order or range: the checks the architecture asks of `eventsInRange` are the caller's. [read 6ee55f6]
- Its errors mask the URL's query with `redactUrlQuery`, but an HTTP failure appends the response body (`.js:194-196`). Log an indexer error's class and status, never its full message, until the body is known to be safe. [read 6ee55f6]
- There is no SDK reader for a block, a raw transaction or a contract's existence: the app has its own small queries in `src/lib/midnight/indexer-block-height.ts:1-40` and `src/lib/midnight/sign-bidirectional-transaction-loader.ts:9-48`. [read 6ee55f6]

## Networks and published values

- `MidnightNetwork` is the enum `undeployed`, `preview`, `preprod`, `mainnet` (`constants.d.ts:39-48`). It is a compiled enum from a dependency, which is fine to import: the ban on `enum` is on this repository's own TypeScript. [read 6ee55f6]
- `getSignerContractAddress`, `getResponderContractAddress`, `getMpcRootPublicKey` and `getMpcOutputCacheUrl` take a `DeployedNetwork` and THROW for a network whose value is not published (`constants.d.ts:57-104`). Today only preprod is published in the app's defaults (`src/lib/midnight/network.ts:301-339`). [read 6ee55f6]
- `normaliseSecp256k1PublicKey` gives a root key its canonical form (`0x04` and 128 hex digits) and throws on anything else. `contractAddressFromHex` with `bytesToHex` gives an address its canonical form, wrapped by the app in `src/lib/midnight/contract-address.ts:21-23`. [read 6ee55f6]
- The SDK imports in plain Node 26: `node -e "import('@sig-net/midnight')"` loads it and `getSignerContractAddress('preprod')` answers. Whether it does on Node 24.18 is gate G10. [run 6ee55f6]
- Importing the SDK brings the onchain runtime WebAssembly (1.6MB), which is allowed on the first page load. It never brings the ledger WebAssembly. [run 6ee55f6]

## The EVM trace

- `evmTraceOutputFromCallFrame(frame: JsonValue): EvmTraceOutput` and the union `EvmTraceOutput` (kinds `Output`, `NoReturnData`, `NotTraced`) are declared in `abi-serde.d.ts:135-222`. It throws on a frame the MPC reads no return data from. [read 6ee55f6]
- The UI's call is `debug_traceTransaction(hash, { tracer: 'callTracer', tracerConfig: { onlyTopCall: true } })` in `src/lib/midnight/evm-transaction-output.ts:33-49`, and its result type there is `EvmTransactionOutput`: `read` with the trace, or `unreadable` with the reason. [read 6ee55f6]
