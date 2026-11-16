// Probe for assumptions A7, A8 and A10: polls the preprod indexer as the ingest will, and tests
// whether a block at or below a tip it reported ever changes.
//
//   IDX       the indexer's GraphQL URL with its token
//   NODE_RPC  the node's JSON-RPC URL with its token (used by this probe alone, to compare hashes)
//   DURATION_MIN  how long to poll (default 30)      POLL_S  seconds between polls (default 4)
//   OUT       where the JSON summary is written (default: indexer-soak.out.json beside this file)
//
// It prints no URL. Run it from the repository root so that the SDK resolves.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { signetEventSourceFromIndexer, getSignerContractAddress, getResponderContractAddress, MidnightNetwork } from '@sig-net/midnight'

const IDX = process.env.IDX
const NODE_RPC = process.env.NODE_RPC
if (!IDX || !NODE_RPC) throw new Error('IDX and NODE_RPC must be set')
const DURATION_MIN = Number(process.env.DURATION_MIN ?? 30)
const POLL_S = Number(process.env.POLL_S ?? 4)
const OUT = process.env.OUT ?? fileURLToPath(new URL('./indexer-soak.out.json', import.meta.url))

// Every request of this process, the SDK's included, is counted by status.
const statuses = {}
let calls = 0
const realFetch = globalThis.fetch
globalThis.fetch = async (...args) => {
  calls++
  try {
    const res = await realFetch(...args)
    statuses[res.status] = (statuses[res.status] ?? 0) + 1
    return res
  } catch (error) {
    statuses.network = (statuses.network ?? 0) + 1
    throw error
  }
}

async function indexerTip() {
  const res = await fetch(IDX, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: '{ block { height hash } }' }) })
  const { height, hash } = (await res.json()).data.block
  return { height, hash: hash.toLowerCase() }
}
async function rpc(method, params) {
  const res = await fetch(NODE_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  return (await res.json()).result
}
const strip = (hex) => (hex ?? '').toLowerCase().replace(/^0x/, '')
async function nodeFinalisedHeight() {
  const header = await rpc('chain_getHeader', [await rpc('chain_getFinalizedHead', [])])
  return Number(BigInt(header.number))
}

const source = signetEventSourceFromIndexer({ queryUrl: IDX })
const contracts = [getSignerContractAddress(MidnightNetwork.Preprod), getResponderContractAddress(MidnightNetwork.Preprod)]
async function eventsIn(fromBlock, toBlock) {
  const found = new Map()
  for (const address of contracts) {
    for await (const e of source.streamSignetEvents(address, { fromBlock, toBlock })) found.set(e.id, e.blockHeight)
  }
  return found
}

const firstRead = new Map() // event id -> block height, as first read at or below a reported tip
const rangeTips = [] // { fromBlock, toBlock }: each range as it was first read, toBlock being the tip then
const startedAt = Date.now()
const tips = [] // every distinct tip the indexer reported
let aheadOfFinalityMax = 0, aheadOfFinalityPolls = 0, polls = 0, failedPolls = 0
const start = await indexerTip()
let cursor = start.height
const deadline = Date.now() + DURATION_MIN * 60_000
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, POLL_S * 1000))
  try {
    const [tip, finalised] = await Promise.all([indexerTip(), nodeFinalisedHeight()])
    polls++
    const ahead = tip.height - finalised
    if (ahead > 0) { aheadOfFinalityPolls++; aheadOfFinalityMax = Math.max(aheadOfFinalityMax, ahead) }
    if (tip.height > cursor) {
      for (const [id, height] of await eventsIn(cursor + 1, tip.height)) firstRead.set(id, height)
      tips.push(tip)
      rangeTips.push({ fromBlock: cursor + 1, toBlock: tip.height })
      cursor = tip.height
    }
  } catch (error) {
    failedPolls++
    console.error('poll failed:', error instanceof Error ? error.message.replace(/project_id=[^&\s"]+/g, 'project_id=***') : 'unknown')
  }
}

// The second read, of the whole range at once, after every block in it has been below the tip.
// A failure here still writes the summary, with `error` set.
let secondRead = new Map(), tipHashMismatches = 0, error = null
try {
  if (cursor > start.height) secondRead = await eventsIn(start.height + 1, cursor)
  for (const tip of tips) {
    if (strip(await rpc('chain_getBlockHash', [tip.height])) !== strip(tip.hash)) tipHashMismatches++
  }
} catch (caught) {
  error = caught instanceof Error ? caught.message.replace(/project_id=[^&\s"]+/g, 'project_id=***') : 'unknown'
}
// How far below the tip of its first read a late event's block was.
const tipWhenRead = (height) => rangeTips.find((r) => height >= r.fromBlock && height <= r.toBlock)?.toBlock ?? null
const late = [...secondRead].filter(([id]) => !firstRead.has(id)).map(([id, height]) => ({ id, height, blocksBelowTip: tipWhenRead(height) === null ? null : tipWhenRead(height) - height }))
const vanished = error === null ? [...firstRead].filter(([id]) => !secondRead.has(id)).map(([id, height]) => ({ id, height })) : []
const summary = {
  error, durationMinutes: DURATION_MIN, elapsedMinutes: Math.round((Date.now() - startedAt) / 6000) / 10, pollSeconds: POLL_S, polls, failedPolls,
  fromBlock: start.height + 1, toBlock: cursor, distinctTips: tips.length,
  eventsFirstRead: firstRead.size, eventsSecondRead: secondRead.size,
  lateEvents: late.length, lateEventMaxBlocksBelowTip: late.reduce((max, e) => Math.max(max, e.blocksBelowTip ?? 0), 0),
  vanishedEvents: vanished.length, lateSample: late.slice(0, 5), vanishedSample: vanished.slice(0, 5),
  tipAheadOfFinalityPolls: aheadOfFinalityPolls, tipAheadOfFinalityMaxBlocks: aheadOfFinalityMax,
  tipHashMismatches, calls, statuses,
}
writeFileSync(OUT, JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
