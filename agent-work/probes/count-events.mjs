// Counts the events of both preprod Signet contracts in the block range FROM..TO (inclusive)
// through the indexer, and prints the count alone. Needs IDX. Run from the repository root.
import { signetEventSourceFromIndexer, getSignerContractAddress, getResponderContractAddress, MidnightNetwork } from '@sig-net/midnight'

const source = signetEventSourceFromIndexer({ queryUrl: process.env.IDX })
const range = { fromBlock: Number(process.env.FROM), toBlock: Number(process.env.TO) }
const ids = new Set()
for (const address of new Set([getSignerContractAddress(MidnightNetwork.Preprod), getResponderContractAddress(MidnightNetwork.Preprod)])) {
  for await (const e of source.streamSignetEvents(address, range)) ids.add(e.id)
}
console.log(ids.size)
