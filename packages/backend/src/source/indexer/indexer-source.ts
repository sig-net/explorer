import { normaliseContractAddressHex, type SignetContractRole } from '@sig-net/explorer-lib'
import {
  type IndexedSignetMiscEvent,
  redactUrlQuery,
  signetEventSourceFromIndexer,
} from '@sig-net/midnight'
import { z } from 'zod'

import type {
  MidnightSource,
  SourceBlock,
  SourceBlockId,
  SourceBlockRange,
  SourceSignetEvent,
} from '../port.ts'

export interface IndexerSourceOptions {
  /** The indexer's GraphQL endpoint. Its query string may carry an access token. */
  readonly queryUrl: string
  readonly signerContractAddress: string
  readonly responderContractAddress: string
  /** How long one request to the indexer may take before it is rejected. */
  readonly timeoutMs?: number
}

/**
 * A {@link MidnightSource} over a Midnight indexer. No error it rejects with carries the query
 * string of `queryUrl`.
 *
 * @throws {Error} When a contract address is not 32 bytes of hex.
 */
export function createIndexerSource({
  queryUrl,
  signerContractAddress,
  responderContractAddress,
  timeoutMs = INDEXER_REQUEST_TIMEOUT_MS,
}: IndexerSourceOptions): MidnightSource {
  const rolesByAddress = new Map<string, SignetContractRole[]>()
  for (const [address, role] of [
    [signerContractAddress, 'signer'],
    [responderContractAddress, 'responder'],
  ] as const) {
    const canonical = normaliseContractAddressHex(address)
    rolesByAddress.set(canonical, [...(rolesByAddress.get(canonical) ?? []), role])
  }
  const events = signetEventSourceFromIndexer({ queryUrl })

  const redacted = <T>(work: () => Promise<T>): Promise<T> =>
    work().catch((error: unknown) => {
      throw new Error(withoutQueryString(queryUrl, reasonOf(error)))
    })

  const graphql = <T>(
    data: z.ZodType<T>,
    query: string,
    variables: Readonly<Record<string, string | number>> = {},
  ): Promise<T> =>
    withDeadline(timeoutMs, 'the indexer', async (signal) => {
      const response = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal,
      })
      if (!response.ok) {
        throw new Error(
          `the indexer answered HTTP ${String(response.status)} for ${redactUrlQuery(queryUrl)}`,
        )
      }
      const body = validated(graphqlResponseSchema, await response.json())
      if (body.errors !== undefined && body.errors.length > 0) {
        throw new Error(
          `the indexer rejected the query: ${body.errors.map(({ message }) => message).join(', ')}`,
        )
      }
      return validated(data, body.data)
    })

  const blockAt = (height: number): Promise<SourceBlockId | null> =>
    graphql(blockAtSchema, BLOCK_AT_QUERY, { height }).then(({ block }) =>
      block === null ? null : { hash: block.hash, time: new Date(block.timestamp) },
    )

  const contractEvents = async (
    address: string,
    { fromBlock, toBlock }: SourceBlockRange,
  ): Promise<IndexedSignetMiscEvent[]> => {
    const pages = events.streamSignetEvents(address, { fromBlock, toBlock })[Symbol.asyncIterator]()
    const read: IndexedSignetMiscEvent[] = []
    for (;;) {
      // Each step of the stream sends at most one request, so each gets a deadline of its own.
      const next = await withDeadline(timeoutMs, 'the indexer', () => pages.next())
      if (next.done === true) {
        return read
      }
      read.push(next.value)
    }
  }

  return {
    genesisHash: () =>
      redacted(async () => {
        const genesis = await blockAt(0)
        if (genesis === null) {
          throw new Error('the indexer holds no genesis block')
        }
        return genesis.hash
      }),
    finalisedTip: () =>
      redacted(async (): Promise<SourceBlock> => {
        const { block } = await graphql(tipSchema, TIP_QUERY)
        if (block === null) {
          throw new Error('the indexer holds no block')
        }
        return { height: block.height, hash: block.hash, time: new Date(block.timestamp) }
      }),
    blockAt: (height) => redacted(() => blockAt(height)),
    eventsIn: (range) =>
      redacted(async () => {
        const merged: SourceSignetEvent[] = []
        for (const [address, roles] of rolesByAddress) {
          for (const event of await contractEvents(address, range)) {
            if (event.blockHeight < range.fromBlock || event.blockHeight > range.toBlock) {
              throw new Error(
                `the indexer served event ${String(event.id)} of block ${String(event.blockHeight)} for blocks ${String(range.fromBlock)} to ${String(range.toBlock)}`,
              )
            }
            merged.push({
              source: {
                id: event.id,
                name: event.name,
                payload: event.payload,
                transactionHash: lowerHex(event.transactionHash),
                blockHeight: event.blockHeight,
                blockHash: lowerHex(event.blockHash),
                blockTimestamp: event.blockTimestamp,
              },
              roles,
            })
          }
        }
        return merged.sort((a, b) => a.source.id - b.source.id)
      }),
    rawTransaction: (hash) =>
      redacted(async () => {
        const { transactions } = await graphql(rawTransactionSchema, RAW_TRANSACTION_QUERY, {
          hash,
        })
        const transaction = transactions[0]
        if (transaction === undefined) {
          throw new Error(`the indexer holds no transaction ${hash}`)
        }
        return transaction.raw
      }),
  }
}

/** How long one request to the indexer may take by default (D50). */
export const INDEXER_REQUEST_TIMEOUT_MS = 30_000

const TIP_QUERY = '{ block { height hash timestamp } }'
const BLOCK_AT_QUERY =
  'query BlockAt($height: Int!) { block(offset: { height: $height }) { hash timestamp } }'
const RAW_TRANSACTION_QUERY =
  'query RawTransaction($hash: HexEncoded!) { transactions(offset: { hash: $hash }) { raw } }'

function lowerHex(hex: string): string {
  return hex.replace(/^0x/i, '').toLowerCase()
}

const hexSchema = z
  .string()
  .regex(/^(?:0x)?(?:[0-9a-fA-F]{2})*$/)
  .transform(lowerHex)
const hashSchema = z
  .string()
  .regex(/^(?:0x)?[0-9a-fA-F]{64}$/)
  .transform(lowerHex)
const timestampSchema = z.number().int().nonnegative()

const graphqlResponseSchema = z.object({
  data: z.unknown(),
  errors: z.array(z.object({ message: z.string() })).optional(),
})
const tipSchema = z.object({
  block: z
    .object({
      height: z.number().int().nonnegative(),
      hash: hashSchema,
      timestamp: timestampSchema,
    })
    .nullable(),
})
const blockAtSchema = z.object({
  block: z.object({ hash: hashSchema, timestamp: timestampSchema }).nullable(),
})
const rawTransactionSchema = z.object({ transactions: z.array(z.object({ raw: hexSchema })) })

/**
 * `work`, rejected with a timeout once `timeoutMs` passes. The signal aborts at the same moment, for
 * work that can stop.
 */
function withDeadline<T>(
  timeoutMs: number,
  what: string,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`${what} did not answer within ${String(timeoutMs)} ms`)
      controller.abort(error)
      reject(error)
    }, timeoutMs)
    work(controller.signal).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

/** `message` with `url` and each value of its query string masked. */
function withoutQueryString(url: string, message: string): string {
  let masked = message.replaceAll(url, redactUrlQuery(url))
  if (URL.canParse(url)) {
    for (const value of new URL(url).searchParams.values()) {
      if (value !== '') {
        masked = masked.replaceAll(value, 'REDACTED')
      }
    }
  }
  return masked
}

/** @throws {Error} When `value` does not validate as `schema`, with zod's account of why. */
function validated<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new Error(`the indexer answered unexpectedly: ${z.prettifyError(result.error)}`)
  }
  return result.data
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
