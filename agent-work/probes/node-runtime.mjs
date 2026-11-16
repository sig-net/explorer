// Probe: do the SDK's indexer event source and the explorer's transaction inspection (ledger
// WebAssembly) run under plain Node, outside Vite? Reads one signer event from preprod, fetches its
// raw transaction and inspects it. Needs IDX, the indexer URL with its token. Prints no URL.
import { signetEventSourceFromIndexer, tryDecodeSignetEvent, getSignerContractAddress, MidnightNetwork } from '@sig-net/midnight'
import { inspectSignBidirectionalTransaction } from '../../src/lib/midnight/sign-bidirectional-transaction-inspection.ts'

const queryUrl = process.env.IDX
const signer = getSignerContractAddress(MidnightNetwork.Preprod)
const source = signetEventSourceFromIndexer({ queryUrl })
let event
for await (const e of source.streamSignetEvents(signer, { fromBlock: 3389203, toBlock: 3389203 })) { event = e; break }
const decoded = tryDecodeSignetEvent(event)
console.log('event', { id: event.id, name: event.name, block: event.blockHeight, decodedOk: decoded?.ok })
const res = await fetch(queryUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query R($hash: HexEncoded!) { transactions(offset: { hash: $hash }) { raw } }', variables: { hash: event.transactionHash } }) })
const raw = (await res.json()).data.transactions[0].raw
console.log('raw transaction bytes', raw.length / 2)
const t0 = performance.now()
const inspection = inspectSignBidirectionalTransaction(raw, decoded.event.requestId, decoded.event.record)
console.log('inspection ms', Math.round(performance.now() - t0), 'callChains', inspection.callChains.length, 'request found', inspection.request !== null, 'chainId', String(inspection.request?.txParams.chainId))
