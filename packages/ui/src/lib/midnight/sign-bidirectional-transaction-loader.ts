import type {
  IndexedSignetMiscEvent,
  RequestIdHex,
  SignBidirectionalNotification,
} from '@sig-net/midnight'

import type { SignBidirectionalTransactionInspection } from '@/lib/midnight/sign-bidirectional-transaction-inspection'

const RAW_TRANSACTION_QUERY = `
  query RawTransaction($hash: HexEncoded!) {
    transactions(offset: { hash: $hash }) { raw }
  }`

/** Narrows the indexer's JSON response to the first transaction's raw hex. */
function rawTransactionHex(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'data' in body) {
    const { data } = body
    if (typeof data === 'object' && data !== null && 'transactions' in data) {
      const { transactions } = data
      const first: unknown = Array.isArray(transactions) ? transactions[0] : undefined
      if (
        typeof first === 'object' &&
        first !== null &&
        'raw' in first &&
        typeof first.raw === 'string'
      ) {
        return first.raw
      }
    }
  }
  throw new Error('the indexer returned no raw transaction for this hash')
}

async function fetchRawTransactionHex(
  indexerUrl: string,
  transactionHash: string,
): Promise<string> {
  const response = await fetch(indexerUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: RAW_TRANSACTION_QUERY, variables: { hash: transactionHash } }),
  })
  if (!response.ok) {
    throw new Error(`the indexer answered ${String(response.status)}`)
  }
  const body: unknown = await response.json()
  return rawTransactionHex(body)
}

/** The decoded notification event whose transaction is inspected. */
export interface SignBidirectionalNotificationEvent {
  readonly requestId: RequestIdHex
  readonly record: SignBidirectionalNotification
  readonly source: IndexedSignetMiscEvent
}

const inspections = new Map<string, Promise<SignBidirectionalTransactionInspection>>()

/**
 * Inspects the transaction that emitted `event`, once per indexer, transaction and request: a
 * finalised transaction never changes, so every later call shares the first result. The ledger
 * WebAssembly behind the inspection loads on the first call. A failed load is forgotten, so the
 * next call retries.
 */
export function loadSignBidirectionalTransactionInspection(
  indexerUrl: string,
  event: SignBidirectionalNotificationEvent,
): Promise<SignBidirectionalTransactionInspection> {
  const key = JSON.stringify([indexerUrl, event.source.transactionHash, event.requestId])
  let inspection = inspections.get(key)
  if (inspection === undefined) {
    inspection = Promise.all([
      fetchRawTransactionHex(indexerUrl, event.source.transactionHash),
      import('@/lib/midnight/sign-bidirectional-transaction-inspection'),
    ]).then(([rawHex, { inspectSignBidirectionalTransaction }]) =>
      inspectSignBidirectionalTransaction(rawHex, event.requestId, event.record),
    )
    inspection.catch(() => inspections.delete(key))
    inspections.set(key, inspection)
  }
  return inspection
}
