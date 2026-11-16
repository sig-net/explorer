import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { createIndexerSource } from './indexer-source.ts'
import {
  type ContractEventRow,
  PREPROD_FIRST_RESPONDER_EVENT_ROW,
  PREPROD_FIRST_SIGNER_EVENT_ROW,
} from './indexer-source.fixture.ts'

const TOKEN = 'secret-project-id'
const QUERY_URL = `https://indexer.test/api/v0?project_id=${TOKEN}`
const SIGNER = 'c423fca48329307ba00383e8c40cf1b3a83a7728a2b6721e863cfa16d25fb3ec'
const RESPONDER = '627ef19bb1db09b4261e31a4f87a6b299581c3d635c409bad9ac4547370ef4d5'
const RANGE = { fromBlock: 3389203, toBlock: 3389208 }

/** A responder event the test places before the signer's first one, in the same block. */
const EARLIER_RESPONDER_EVENT_ROW: ContractEventRow = {
  ...PREPROD_FIRST_RESPONDER_EVENT_ROW,
  id: 1871470,
  transaction: PREPROD_FIRST_SIGNER_EVENT_ROW.transaction,
}

const requestSchema = z.object({
  query: z.string(),
  variables: z
    .object({
      filter: z.object({ contractAddress: z.string() }).optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    })
    .optional(),
})

type IndexerRequest = z.infer<typeof requestSchema>

/** Stubs `fetch` with an indexer that answers each request's GraphQL body with `answer`. */
function stubIndexer(answer: (request: IndexerRequest) => Promise<Response> | Response) {
  const fetchStub = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
    (_input, init) => {
      if (typeof init?.body !== 'string') {
        throw new Error('the adaptor sent no JSON body')
      }
      const body: unknown = JSON.parse(init.body)
      return Promise.resolve(answer(requestSchema.parse(body)))
    },
  )
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

/** An indexer whose contracts hold `rows` by address. */
function eventsIndexer(rows: Readonly<Record<string, readonly ContractEventRow[]>>) {
  return stubIndexer(({ variables }) =>
    Response.json({
      data: { contractEvents: rows[variables?.filter?.contractAddress ?? ''] ?? [] },
    }),
  )
}

function source(
  addresses = { signer: SIGNER, responder: RESPONDER },
  timeoutMs?: number,
  queryUrl = QUERY_URL,
) {
  return createIndexerSource({
    queryUrl,
    signerContractAddress: addresses.signer,
    responderContractAddress: addresses.responder,
    timeoutMs,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createIndexerSource', () => {
  it('merges both contracts by event id', async () => {
    eventsIndexer({
      [SIGNER]: [PREPROD_FIRST_SIGNER_EVENT_ROW],
      [RESPONDER]: [EARLIER_RESPONDER_EVENT_ROW, PREPROD_FIRST_RESPONDER_EVENT_ROW],
    })
    const events = await source().eventsIn(RANGE)
    expect(events.map(({ source: { id }, roles }) => [id, roles])).toEqual([
      [1871470, ['responder']],
      [1871480, ['signer']],
      [1871492, ['responder']],
    ])
    expect(events[1]?.source).toEqual({
      id: 1871480,
      name: 'SignBidirectionalEvent',
      payload: expect.any(Uint8Array),
      transactionHash: 'bf6343d6b766b86fcae35f1301b447caab99892aaad9d6d85f568377f8dce583',
      blockHeight: 3389203,
      blockHash: '9ab46ce1f6b30dcb2f4b348c7933eb1a9f46725281b199bbe832af9bfc783a51',
      blockTimestamp: new Date(1794481272000),
    })
  })

  it('reads a contract configured in both roles once', async () => {
    const fetchStub = eventsIndexer({ [SIGNER]: [PREPROD_FIRST_SIGNER_EVENT_ROW] })
    const events = await source({
      signer: SIGNER,
      responder: `0x${SIGNER.toUpperCase()}`,
    }).eventsIn(RANGE)
    expect(fetchStub).toHaveBeenCalledTimes(1)
    expect(events.map(({ source: { id }, roles }) => [id, roles])).toEqual([
      [1871480, ['signer', 'responder']],
    ])
  })

  it('rejects an event outside the range', async () => {
    eventsIndexer({
      [SIGNER]: [PREPROD_FIRST_SIGNER_EVENT_ROW],
      [RESPONDER]: [PREPROD_FIRST_RESPONDER_EVENT_ROW],
    })
    await expect(source().eventsIn({ fromBlock: 3389203, toBlock: 3389207 })).rejects.toThrow(
      'the indexer served event 1871492 of block 3389208 for blocks 3389203 to 3389207',
    )
  })

  it('answers null for a block above the tip', async () => {
    stubIndexer(() => Response.json({ data: { block: null } }))
    await expect(source().blockAt(999_999_999)).resolves.toBeNull()
  })

  it('reads a block at a height', async () => {
    stubIndexer(() =>
      Response.json({
        data: {
          block: {
            hash: PREPROD_FIRST_RESPONDER_EVENT_ROW.transaction.block.hash.toUpperCase(),
            timestamp: 1794481302000,
          },
        },
      }),
    )
    await expect(source().blockAt(3389208)).resolves.toEqual({
      hash: 'ada9ad5111c2d14e8ad3c40d79c420a0233e742cb1fcb7311dc8c4ddd72ed13b',
      time: new Date(1794481302000),
    })
  })

  it('rejects a response that does not validate', async () => {
    stubIndexer(() =>
      Response.json({ data: { block: { height: 7, hash: 'not hex', timestamp: 1794481302000 } } }),
    )
    await expect(source().finalisedTip()).rejects.toThrow(
      /^the indexer answered unexpectedly: .*\n.*block\.hash/,
    )
  })

  it('rejects when the indexer holds no such transaction', async () => {
    stubIndexer(() => Response.json({ data: { transactions: [] } }))
    await expect(source().rawTransaction('aa'.repeat(32))).rejects.toThrow(
      `the indexer holds no transaction ${'aa'.repeat(32)}`,
    )
  })

  it('a request that never answers is rejected after the timeout', async () => {
    stubIndexer(() => new Promise<Response>(() => undefined))
    const silent = source(undefined, 20)
    await expect(silent.finalisedTip()).rejects.toThrow('the indexer did not answer within 20 ms')
    await expect(silent.eventsIn(RANGE)).rejects.toThrow('the indexer did not answer within 20 ms')
  })

  it('an error carries no query string', async () => {
    const reasons: string[] = []
    const reasonOf = (error: unknown): void => {
      reasons.push(error instanceof Error ? error.message : String(error))
    }
    stubIndexer(() => Promise.reject(new Error(`fetch failed for ${QUERY_URL}`)))
    await source().finalisedTip().catch(reasonOf)
    stubIndexer(() => new Response(`no access for ${QUERY_URL}`, { status: 403 }))
    await source().genesisHash().catch(reasonOf)
    await source().eventsIn(RANGE).catch(reasonOf)
    expect(reasons).toHaveLength(3)
    for (const reason of reasons) {
      expect(reason).not.toContain(TOKEN)
      expect(reason).toContain('indexer.test')
    }
  })

  it('the source masks a token the server echoes percent encoded', async () => {
    const token = 'pr/oj ect+id&9'
    const encoded = encodeURIComponent(token)
    const queryUrl = `https://indexer.test/api/v0?project_id=${encoded}`
    const echoes = [
      queryUrl,
      `project_id=${encoded}`,
      `project_id=${encoded.toLowerCase()}`,
      `project_id=${new URLSearchParams({ token }).toString().slice('token='.length)}`,
      `project_id=${token}`,
    ]
    for (const echo of echoes) {
      stubIndexer(() =>
        Response.json({ data: null, errors: [{ message: `no access with ${echo}` }] }),
      )
      const rejection = await source(undefined, undefined, queryUrl)
        .finalisedTip()
        .then(
          () => 'resolved',
          (error: unknown) => (error instanceof Error ? error.message : String(error)),
        )
      expect(rejection).toContain('the indexer rejected the query: no access with ')
      expect(rejection).toContain('REDACTED')
      for (const form of [token, encoded, encoded.toLowerCase(), 'oj ect', 'oj+ect', 'oj%20ect']) {
        expect(rejection).not.toContain(form)
      }
    }
  })

  it('the source reads a range that spans several pages', async () => {
    const rows = Array.from({ length: 250 }, (_, index): ContractEventRow => ({
      ...PREPROD_FIRST_SIGNER_EVENT_ROW,
      id: PREPROD_FIRST_SIGNER_EVENT_ROW.id + index * 3,
    }))
    const signerOffsets: (number | undefined)[] = []
    const fetchStub = stubIndexer(({ variables }) => {
      if (variables?.filter?.contractAddress !== SIGNER) {
        return Response.json({ data: { contractEvents: [] } })
      }
      const offset = variables.offset ?? 0
      signerOffsets.push(variables.offset)
      return Response.json({
        data: { contractEvents: rows.slice(offset, offset + (variables.limit ?? rows.length)) },
      })
    })

    const events = await source().eventsIn(RANGE)

    expect(signerOffsets).toEqual([0, 100, 200])
    expect(fetchStub).toHaveBeenCalledTimes(4)
    expect(events.map(({ source: { id } }) => id)).toEqual(rows.map(({ id }) => id))
  })
})
