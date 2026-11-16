import type { ContractCallNode } from '@sig-net/explorer-api'
import { MIDNIGHT_NETWORKS, type SignetContractEvent } from '@sig-net/explorer-lib'
import {
  indexedSignetContractEvent,
  notificationEvent,
  responseEvent,
} from '@sig-net/explorer-lib/testing'
import { MidnightNetwork, SignetEventName } from '@sig-net/midnight'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { migrateNetworkSchema, wipeNetworkSchema } from '../db/migrate.ts'
import { networkDb, type StoredInspection } from '../db/schema.ts'
import { createTestDatabase, seedNetworkEvents, type TestDatabase } from '../db/testing.ts'
import { createInMemoryMidnightSource } from '../source/in-memory.ts'
import type { MidnightSource, SourceBlockRange } from '../source/port.ts'
import {
  type IngestCycleOutcome,
  type IngestCycleSettings,
  type InspectTransaction,
  runIngestCycle,
} from './ingest-cycle.ts'
import {
  at,
  blockOf,
  chainOf,
  FIRST_BLOCK,
  GENESIS_HASH,
  inspectedWithoutCells,
  rawOf,
  SETTINGS,
  sourceEventOf,
  transactionHashOf,
  blockHash,
  blockTime,
} from './testing.ts'

const NETWORK = SETTINGS.network
const REBUILD_NETWORK = MidnightNetwork.Preview

const REQUEST_A = new Uint8Array(32).fill(0xa1)
const REQUEST_B = new Uint8Array(32).fill(0xb2)
const REQUEST_C = new Uint8Array(32).fill(0xc3)
const REQUEST_A_HEX = 'a1'.repeat(32)
const CALLER_1 = new Uint8Array(32).fill(0xc1)
const CALLER_2 = new Uint8Array(32).fill(0xc2)
const CALLER_1_HEX = 'c1'.repeat(32)
const CALLER_2_HEX = 'c2'.repeat(32)

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
})

afterAll(async () => {
  await database.drop()
})

beforeEach(async () => {
  for (const network of MIDNIGHT_NETWORKS) {
    await wipeNetworkSchema(database.db, network)
  }
  await migrateNetworkSchema(database.db, NETWORK)
})

function notification(id: number, requestId = REQUEST_A, caller = CALLER_1): SignetContractEvent {
  return notificationEvent(id, requestId, caller, 0)
}

function signature(id: number, requestId = REQUEST_A): SignetContractEvent {
  return responseEvent(id, SignetEventName.SignatureRespondedEvent, requestId, 0)
}

function attestation(id: number, requestId = REQUEST_A): SignetContractEvent {
  return responseEvent(id, SignetEventName.RespondBidirectionalEvent, requestId, 0)
}

function callNode(entryPoint: string): ContractCallNode {
  return { entryPoint, address: 'a0'.repeat(32), fallible: false, calls: [] }
}

interface InspectCall {
  readonly raw: string
  readonly notificationIds: readonly number[]
}

function recordingInspect(answer: InspectTransaction = inspectedWithoutCells): {
  readonly calls: InspectCall[]
  readonly inspect: InspectTransaction
} {
  const calls: InspectCall[] = []
  return {
    calls,
    inspect: (raw, notifications) => {
      calls.push({ raw, notificationIds: notifications.map(({ source }) => source.id) })
      return answer(raw, notifications)
    },
  }
}

function cycle(
  source: MidnightSource,
  settings: Partial<IngestCycleSettings> = {},
  inspect: InspectTransaction = inspectedWithoutCells,
): Promise<IngestCycleOutcome> {
  return runIngestCycle({ db: database.db, source, inspect }, { ...SETTINGS, ...settings })
}

/** `source` with a record of the ranges and the raw transactions read from it. */
function observed(source: MidnightSource): {
  readonly source: MidnightSource
  readonly ranges: SourceBlockRange[]
  readonly rawFetches: string[]
} {
  const ranges: SourceBlockRange[] = []
  const rawFetches: string[] = []
  return {
    ranges,
    rawFetches,
    source: {
      ...source,
      eventsIn: (range) => {
        ranges.push(range)
        return source.eventsIn(range)
      },
      rawTransaction: (hash) => {
        rawFetches.push(hash)
        return source.rawTransaction(hash)
      },
    },
  }
}

const SOURCE_METHODS = [
  'genesisHash',
  'finalisedTip',
  'blockAt',
  'eventsIn',
  'rawTransaction',
] as const

function failingAt(
  source: MidnightSource,
  method: (typeof SOURCE_METHODS)[number],
  error: Error,
): MidnightSource {
  return { ...source, [method]: () => Promise.reject(error) }
}

/** `source` whose `eventsIn` answers only once `parties` calls have reached it. */
function meetingAtEventsIn(source: MidnightSource, parties: number): MidnightSource {
  const waiting: (() => void)[] = []
  return {
    ...source,
    eventsIn: async (range) => {
      if (waiting.length + 1 < parties) {
        await new Promise<void>((resolve) => {
          waiting.push(resolve)
        })
      } else {
        for (const release of waiting.splice(0)) {
          release()
        }
      }
      return source.eventsIn(range)
    },
  }
}

async function stateOf(network: MidnightNetwork = NETWORK) {
  return networkDb(database.db, network)
    .selectFrom('ingest_state')
    .selectAll()
    .executeTakeFirstOrThrow()
}

async function requestsOf(network: MidnightNetwork = NETWORK) {
  return networkDb(database.db, network)
    .selectFrom('requests')
    .selectAll()
    .orderBy('request_id')
    .execute()
}

async function callersOf(network: MidnightNetwork = NETWORK) {
  return networkDb(database.db, network)
    .selectFrom('request_callers')
    .selectAll()
    .orderBy('request_id')
    .orderBy('caller')
    .execute()
}

async function transactionsOf() {
  return networkDb(database.db, NETWORK)
    .selectFrom('transactions')
    .selectAll()
    .orderBy('block_height')
    .orderBy('hash')
    .execute()
}

async function eventsOf() {
  return networkDb(database.db, NETWORK).selectFrom('events').selectAll().orderBy('id').execute()
}

async function eventIds(): Promise<number[]> {
  return (await eventsOf()).map((event) => event.id)
}

/** Every row of the network's schema, with the state's error and stop apart from the rest. */
async function snapshot() {
  const { state, last_error: lastError, ...ingestState } = await stateOf()
  return {
    state,
    lastError,
    stored: {
      ingestState,
      transactions: await transactionsOf(),
      events: await eventsOf(),
      requests: await requestsOf(),
      callers: await callersOf(),
    },
  }
}

function bytes(hex: string): Buffer {
  return Buffer.from(hex, 'hex')
}

describe('the ingest cycle', () => {
  it('the first cycle records the identity and starts at the start block', async () => {
    const placed = [at(1002, notification(1)), at(1004, notification(2, REQUEST_B))]
    const { source, ranges } = observed(chainOf(1004, placed))

    expect(await cycle(source, { startBlock: 1003 })).toEqual({ kind: 'caught-up' })
    expect(await stateOf()).toMatchObject({
      genesis_hash: bytes(GENESIS_HASH),
      signer_address: bytes(SETTINGS.signerContractAddress),
      responder_address: bytes(SETTINGS.responderContractAddress),
      start_block: 1003,
      cursor_height: null,
      cursor_hash: null,
      cursor_block_time: null,
      tip_height: 1004,
      state: 'synced',
    })
    expect(ranges).toEqual([])

    const longer = observed(chainOf(1010, placed))
    expect(await cycle(longer.source, { startBlock: 1003 })).toEqual({
      kind: 'stored',
      fromBlock: 1003,
      toBlock: 1008,
      events: 1,
    })
    expect(longer.ranges).toEqual([{ fromBlock: 1003, toBlock: 1008 }])
    expect(await eventIds()).toEqual([2])
    expect(await stateOf()).toMatchObject({ start_block: 1003, cursor_height: 1008 })
  })

  it('stores a range and moves the cursor together', async () => {
    const placed = [at(1002, notification(1)), at(1003, signature(2)), at(1005, attestation(3))]
    const [first, second, third] = placed.map((event) => sourceEventOf(event).source)
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('three events are placed')
    }

    expect(await cycle(chainOf(1010, placed))).toEqual({
      kind: 'stored',
      fromBlock: 1001,
      toBlock: 1008,
      events: 3,
    })

    const state = await stateOf()
    expect(state).toMatchObject({
      cursor_height: 1008,
      cursor_hash: bytes(blockHash(1008)),
      cursor_block_time: blockTime(1008),
      tip_height: 1010,
      state: 'synced',
      last_error: null,
    })
    expect(state.last_success_at).toBeInstanceOf(Date)
    expect(await transactionsOf()).toEqual([
      {
        hash: bytes(first.transactionHash),
        block_height: 1002,
        block_hash: bytes(blockHash(1002)),
        block_time: blockTime(1002),
        raw: bytes(rawOf(first.transactionHash)),
        inspection: { callChains: [], requests: { '1': { cell: null } } },
      },
      {
        hash: bytes(second.transactionHash),
        block_height: 1003,
        block_hash: bytes(blockHash(1003)),
        block_time: blockTime(1003),
        raw: null,
        inspection: null,
      },
      {
        hash: bytes(third.transactionHash),
        block_height: 1005,
        block_hash: bytes(blockHash(1005)),
        block_time: blockTime(1005),
        raw: null,
        inspection: null,
      },
    ])
    expect(await eventsOf()).toEqual([
      {
        id: 1,
        transaction_hash: bytes(first.transactionHash),
        contract_roles: ['signer'],
        name: SignetEventName.SignBidirectionalEvent,
        payload: Buffer.from(first.payload),
        request_id: REQUEST_A_HEX,
        decode_failure: null,
      },
      {
        id: 2,
        transaction_hash: bytes(second.transactionHash),
        contract_roles: ['responder'],
        name: SignetEventName.SignatureRespondedEvent,
        payload: Buffer.from(second.payload),
        request_id: REQUEST_A_HEX,
        decode_failure: null,
      },
      {
        id: 3,
        transaction_hash: bytes(third.transactionHash),
        contract_roles: ['responder'],
        name: SignetEventName.RespondBidirectionalEvent,
        payload: Buffer.from(third.payload),
        request_id: REQUEST_A_HEX,
        decode_failure: null,
      },
    ])
    expect(await requestsOf()).toEqual([
      {
        request_id: REQUEST_A_HEX,
        first_event_id: 1,
        first_requested_at: blockTime(1002),
        first_signature_at: blockTime(1003),
        first_response_at: blockTime(1005),
        sign_bidirectional_count: 1,
        signature_responded_count: 1,
        respond_bidirectional_count: 1,
      },
    ])
    expect(await callersOf()).toEqual([{ request_id: REQUEST_A_HEX, caller: CALLER_1_HEX }])
  })

  it('a failing read leaves the cursor and the tables unchanged', async () => {
    const source = chainOf(1010, [at(1002, notification(1)), at(1005, notification(2))])
    expect(await cycle(source, { maxRange: 3 })).toMatchObject({ kind: 'stored', toBlock: 1003 })
    const before = await snapshot()
    expect(before.stored.events).toHaveLength(1)

    for (const method of SOURCE_METHODS) {
      const failing = failingAt(source, method, new Error(`${method} is down`))
      expect(await cycle(failing, { maxRange: 3 })).toEqual({
        kind: 'failed',
        error: `${method} is down`,
      })
      expect(await snapshot()).toEqual({ ...before, lastError: `${method} is down` })
    }

    source.failNextCall(new Error('the next call fails'))
    expect(await cycle(source, { maxRange: 3 })).toEqual({
      kind: 'failed',
      error: 'the next call fails',
    })
    expect(await snapshot()).toEqual({ ...before, lastError: 'the next call fails' })

    for (const missing of [1003, 1006]) {
      const behind: MidnightSource = {
        ...source,
        blockAt: (height) => (height === missing ? Promise.resolve(null) : source.blockAt(height)),
      }
      const outcome = await cycle(behind, { maxRange: 3 })
      expect(outcome).toEqual({
        kind: 'failed',
        error: expect.stringContaining(`the source holds no block ${String(missing)}`),
      })
      expect((await snapshot()).stored).toEqual(before.stored)
      expect((await stateOf()).state).toBe('syncing')
    }

    expect(await cycle(source, { maxRange: 3 })).toEqual({
      kind: 'stored',
      fromBlock: 1004,
      toBlock: 1006,
      events: 1,
    })
    expect(await stateOf()).toMatchObject({ cursor_height: 1006, last_error: null })
  })

  it('a failure inside the transaction stores nothing', async () => {
    const placed = [at(1002, notification(1)), at(1005, signature(2))]
    const planted = {
      hash: bytes('ee'.repeat(32)),
      block_height: 1,
      block_hash: bytes(blockHash(1)),
      block_time: blockTime(1),
      raw: null,
      inspection: null,
    }
    // The planted event holds the id of the last event of the range, so the cycle fails after it
    // has moved the cursor and inserted its transactions.
    const plantedEvent = {
      id: 2,
      transaction_hash: planted.hash,
      contract_roles: ['signer' as const],
      name: 'PlantedEvent',
      payload: Buffer.from([1]),
      request_id: null,
      decode_failure: null,
    }
    const tables = networkDb(database.db, NETWORK)
    await tables.insertInto('transactions').values(planted).execute()
    await tables.insertInto('events').values(plantedEvent).execute()

    const outcome = await cycle(chainOf(1010, placed))

    expect(outcome).toEqual({ kind: 'failed', error: expect.stringContaining('duplicate key') })
    expect(await stateOf()).toMatchObject({
      cursor_height: null,
      cursor_hash: null,
      cursor_block_time: null,
      tip_height: null,
      last_success_at: null,
      state: 'syncing',
      last_error: expect.stringContaining('duplicate key'),
    })
    expect(await transactionsOf()).toEqual([planted])
    expect(await eventsOf()).toEqual([plantedEvent])
    expect(await requestsOf()).toEqual([])
    expect(await callersOf()).toEqual([])
  })

  it('a cycle after a commit reads on from the new cursor and stores nothing twice', async () => {
    const { source, ranges } = observed(
      chainOf(1010, [
        at(1002, notification(1)),
        at(1004, signature(2)),
        at(1005, attestation(3)),
        at(1008, notification(4, REQUEST_B)),
      ]),
    )

    expect(await cycle(source, { maxRange: 4 })).toEqual({
      kind: 'stored',
      fromBlock: 1001,
      toBlock: 1004,
      events: 2,
    })
    expect(await cycle(source, { maxRange: 4 })).toEqual({
      kind: 'stored',
      fromBlock: 1005,
      toBlock: 1008,
      events: 2,
    })
    expect(await cycle(source, { maxRange: 4 })).toEqual({ kind: 'caught-up' })

    expect(ranges).toEqual([
      { fromBlock: 1001, toBlock: 1004 },
      { fromBlock: 1005, toBlock: 1008 },
    ])
    expect(await eventIds()).toEqual([1, 2, 3, 4])
    expect(await transactionsOf()).toHaveLength(4)
    expect(await requestsOf()).toHaveLength(2)
  })

  it('of two cycles from one cursor only one commits', async () => {
    const source = chainOf(1020, [at(1002, notification(1)), at(1007, notification(2))])

    for (const [toBlock, ids] of [
      [1005, [1]],
      [1010, [1, 2]],
    ] as const) {
      const meeting = meetingAtEventsIn(source, 2)
      const outcomes = await Promise.all([
        cycle(meeting, { maxRange: 5 }),
        cycle(meeting, { maxRange: 5 }),
      ])

      expect(
        outcomes.map((outcome) => outcome.kind).toSorted((a, b) => a.localeCompare(b)),
      ).toEqual(['stored', 'superseded'])
      expect(await stateOf()).toMatchObject({ cursor_height: toBlock, last_error: null })
      expect(await eventIds()).toEqual(ids)
    }
  })

  it('a changed genesis hash stops the network and writes nothing', async () => {
    const placed = [at(1002, notification(1)), at(1005, notification(2))]
    expect(await cycle(chainOf(1010, placed), { maxRange: 3 })).toMatchObject({ kind: 'stored' })
    const before = await snapshot()
    const otherChain = createInMemoryMidnightSource(
      '77'.repeat(32),
      Array.from({ length: 10 }, (_, index) => blockOf(FIRST_BLOCK + index, placed)),
    )

    const outcome = await cycle(otherChain, { maxRange: 3 })

    const reason = `the source's genesis hash is ${'77'.repeat(32)} and the schema was indexed for ${GENESIS_HASH}`
    expect(outcome).toEqual({ kind: 'stopped', reason })
    expect(await snapshot()).toEqual({ ...before, state: 'stopped', lastError: reason })
  })

  it('a replaced cursor block stops the network', async () => {
    const placed = [at(1002, notification(1)), at(1005, notification(2))]
    const source = chainOf(1010, placed)
    expect(await cycle(source, { maxRange: 3 })).toMatchObject({ kind: 'stored', toBlock: 1003 })
    const before = await snapshot()
    source.replaceBlock(blockOf(1003, placed, 1))

    const outcome = await cycle(source, { maxRange: 3 })

    const reason = `the source's block 1003 is ${blockHash(1003, 1)} and the cursor holds ${blockHash(1003)}`
    expect(outcome).toEqual({ kind: 'stopped', reason })
    expect(await snapshot()).toEqual({ ...before, state: 'stopped', lastError: reason })
  })

  it('changed contract addresses or start block stop the network', async () => {
    const source = chainOf(1010, [at(1002, notification(1)), at(1005, notification(2))])
    expect(await cycle(source, { maxRange: 3 })).toMatchObject({ kind: 'stored' })
    const before = await snapshot()

    const changes: readonly [Partial<IngestCycleSettings>, string][] = [
      [{ signerContractAddress: 'a9'.repeat(32) }, 'the signer contract address is a9a9'],
      [{ responderContractAddress: 'b9'.repeat(32) }, 'the responder contract address is b9b9'],
      [{ startBlock: 1002 }, 'the start block is 1002 and the schema was indexed from 1001'],
    ]
    for (const [change, reason] of changes) {
      await networkDb(database.db, NETWORK)
        .updateTable('ingest_state')
        .set({ state: 'syncing', last_error: null })
        .execute()

      const outcome = await cycle(source, { maxRange: 3, ...change })

      expect(outcome).toEqual({ kind: 'stopped', reason: expect.stringContaining(reason) })
      const after = await snapshot()
      expect(after.stored).toEqual(before.stored)
      expect(after.state).toBe('stopped')
      expect(after.lastError).toContain(reason)
    }
  })

  it('never reads past the tip less the margin, nor more than the range', async () => {
    const chain = chainOf(1010, [
      at(1003, notification(1)),
      at(1008, signature(2)),
      at(1009, attestation(3)),
    ])
    const { source, ranges } = observed(chain)
    const settings = { maxRange: 3, tipMargin: 2 }

    expect(await cycle(source, settings)).toMatchObject({ kind: 'stored', toBlock: 1003 })
    expect(await stateOf()).toMatchObject({ cursor_height: 1003, state: 'syncing' })
    expect(await cycle(source, settings)).toMatchObject({ kind: 'stored', toBlock: 1006 })
    expect(await stateOf()).toMatchObject({ cursor_height: 1006, state: 'syncing' })
    expect(await cycle(source, settings)).toMatchObject({ kind: 'stored', toBlock: 1008 })
    expect(await stateOf()).toMatchObject({ cursor_height: 1008, state: 'synced' })
    expect(await cycle(source, settings)).toEqual({ kind: 'caught-up' })
    expect(await stateOf()).toMatchObject({
      cursor_height: 1008,
      cursor_hash: bytes(blockHash(1008)),
      tip_height: 1010,
      state: 'synced',
      last_error: null,
    })
    expect(ranges).toEqual([
      { fromBlock: 1001, toBlock: 1003 },
      { fromBlock: 1004, toBlock: 1006 },
      { fromBlock: 1007, toBlock: 1008 },
    ])
    expect(await eventIds()).toEqual([1, 2])

    chain.appendBlock(blockOf(1011, []))
    expect(await cycle(source, settings)).toEqual({
      kind: 'stored',
      fromBlock: 1009,
      toBlock: 1009,
      events: 1,
    })
    expect(await stateOf()).toMatchObject({
      cursor_height: 1009,
      tip_height: 1011,
      state: 'synced',
    })
    expect(await eventIds()).toEqual([1, 2, 3])
  })

  it('a response stored before its request completes the same row', async () => {
    const source = chainOf(1010, [at(1002, signature(1)), at(1004, notification(2))])

    expect(await cycle(source, { maxRange: 2 })).toMatchObject({ kind: 'stored', events: 1 })
    expect(await requestsOf()).toEqual([
      {
        request_id: REQUEST_A_HEX,
        first_event_id: 1,
        first_requested_at: null,
        first_signature_at: blockTime(1002),
        first_response_at: null,
        sign_bidirectional_count: 0,
        signature_responded_count: 1,
        respond_bidirectional_count: 0,
      },
    ])
    expect(await callersOf()).toEqual([])

    expect(await cycle(source, { maxRange: 2 })).toMatchObject({ kind: 'stored', events: 1 })
    expect(await requestsOf()).toEqual([
      {
        request_id: REQUEST_A_HEX,
        first_event_id: 1,
        first_requested_at: blockTime(1004),
        first_signature_at: blockTime(1002),
        first_response_at: null,
        sign_bidirectional_count: 1,
        signature_responded_count: 1,
        respond_bidirectional_count: 0,
      },
    ])
    expect(await callersOf()).toEqual([{ request_id: REQUEST_A_HEX, caller: CALLER_1_HEX }])
  })

  it('stores every caller of a request notified twice', async () => {
    const source = chainOf(1010, [
      at(1002, notification(1, REQUEST_A, CALLER_1)),
      at(1005, notification(2, REQUEST_A, CALLER_2)),
      at(1006, notification(3, REQUEST_A, CALLER_1)),
    ])

    expect(await cycle(source, { maxRange: 3 })).toMatchObject({ kind: 'stored', events: 1 })
    expect(await cycle(source, { maxRange: 3 })).toMatchObject({ kind: 'stored', events: 2 })

    expect(await callersOf()).toEqual([
      { request_id: REQUEST_A_HEX, caller: CALLER_1_HEX },
      { request_id: REQUEST_A_HEX, caller: CALLER_2_HEX },
    ])
    expect(await requestsOf()).toMatchObject([
      { request_id: REQUEST_A_HEX, first_event_id: 1, sign_bidirectional_count: 3 },
    ])
  })

  it(
    'the request rows equal a rebuild from the stored events after any order of arrival',
    { timeout: 120_000 },
    async () => {
      const events = [
        notification(1, REQUEST_A, CALLER_1),
        signature(2, REQUEST_A),
        attestation(3, REQUEST_A),
        notification(4, REQUEST_A, CALLER_2),
        signature(5, REQUEST_B),
        notification(6, REQUEST_C, CALLER_1),
        indexedSignetContractEvent(7, 'signer', SignetEventName.SignBidirectionalEvent, [9], 0),
        signature(8, REQUEST_A),
        attestation(9, REQUEST_C),
      ]
      // Each order gives, for the event at each index, its block after the first.
      const orders = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8],
        [8, 7, 6, 5, 4, 3, 2, 1, 0],
        [4, 5, 6, 7, 8, 0, 1, 2, 3],
        [3, 0, 7, 0, 5, 8, 2, 5, 1],
      ]

      for (const order of orders) {
        for (const maxRange of [1, 4, 100]) {
          for (const network of [NETWORK, REBUILD_NETWORK]) {
            await wipeNetworkSchema(database.db, network)
            await migrateNetworkSchema(database.db, network)
          }
          const placed = events.map((event, index) => at(FIRST_BLOCK + (order[index] ?? 0), event))
          const source = chainOf(FIRST_BLOCK + events.length + SETTINGS.tipMargin, placed)

          let outcome = await cycle(source, { maxRange })
          while (outcome.kind === 'stored') {
            outcome = await cycle(source, { maxRange })
          }
          expect(outcome).toEqual({ kind: 'caught-up' })
          await seedNetworkEvents(
            database.db,
            REBUILD_NETWORK,
            placed.map((event) => ({ ...event.event, source: sourceEventOf(event).source })),
            new Map<string, StoredInspection>(),
          )

          const requests = await requestsOf()
          expect(requests).toHaveLength(3)
          expect(requests).toEqual(await requestsOf(REBUILD_NETWORK))
          const callers = await callersOf()
          expect(callers).toHaveLength(3)
          expect(callers).toEqual(await callersOf(REBUILD_NETWORK))
        }
      }
    },
  )

  it('stores an event that does not decode without a request row', async () => {
    const undecodable = indexedSignetContractEvent(
      1,
      'signer',
      SignetEventName.SignBidirectionalEvent,
      [9],
      0,
    )
    const unrecognised = indexedSignetContractEvent(2, 'responder', 'AnotherEvent', [1], 0)
    if (undecodable.kind !== 'undecodable' || unrecognised.kind !== 'unrecognised') {
      throw new Error('the fixture events decode')
    }
    const { calls, inspect } = recordingInspect()

    const outcome = await cycle(
      chainOf(1010, [at(1002, undecodable), at(1003, unrecognised)]),
      {},
      inspect,
    )

    expect(outcome).toMatchObject({ kind: 'stored', events: 2 })
    expect(await eventsOf()).toMatchObject([
      {
        id: 1,
        name: SignetEventName.SignBidirectionalEvent,
        payload: Buffer.from(undecodable.source.payload),
        request_id: null,
        decode_failure: undecodable.reason,
      },
      { id: 2, name: 'AnotherEvent', request_id: null, decode_failure: null },
    ])
    expect(await requestsOf()).toEqual([])
    expect(await callersOf()).toEqual([])
    expect(await transactionsOf()).toMatchObject([
      { block_height: 1002, raw: null, inspection: null },
      { block_height: 1003, raw: null, inspection: null },
    ])
    expect(calls).toEqual([])
  })

  it('inspects a transaction once with all its notifications and stores a failed inspection', async () => {
    const shared = 'd1'.repeat(32)
    const thrown = 'd2'.repeat(32)
    const refused = 'd3'.repeat(32)
    const { source, rawFetches } = observed(
      chainOf(1010, [
        at(1002, notification(1, REQUEST_A), shared),
        at(1002, notification(2, REQUEST_B), shared),
        at(1002, signature(3, REQUEST_A), shared),
        at(1003, notification(4, REQUEST_C), thrown),
        at(1004, notification(5, REQUEST_C), refused),
      ]),
    )
    const { calls, inspect } = recordingInspect((raw, notifications) => {
      if (raw === rawOf(thrown)) {
        throw new Error('cannot read https://indexer.example/api/v0?project_id=SECRET')
      }
      return raw === rawOf(refused)
        ? { failed: 'no call chain' }
        : inspectedWithoutCells(raw, notifications)
    })

    expect(await cycle(source, {}, inspect)).toMatchObject({ kind: 'stored', events: 5 })

    expect(calls.toSorted((a, b) => a.raw.localeCompare(b.raw))).toEqual([
      { raw: rawOf(shared), notificationIds: [1, 2] },
      { raw: rawOf(thrown), notificationIds: [4] },
      { raw: rawOf(refused), notificationIds: [5] },
    ])
    expect(rawFetches.toSorted((a, b) => a.localeCompare(b))).toEqual([shared, thrown, refused])
    expect(await transactionsOf()).toMatchObject([
      {
        hash: bytes(shared),
        raw: bytes(rawOf(shared)),
        inspection: { callChains: [], requests: { '1': { cell: null }, '2': { cell: null } } },
      },
      {
        hash: bytes(thrown),
        raw: bytes(rawOf(thrown)),
        inspection: { failed: 'cannot read https://indexer.example/api/v0' },
      },
      { hash: bytes(refused), raw: bytes(rawOf(refused)), inspection: { failed: 'no call chain' } },
    ])
  })

  it('an inspection holding a NUL character is stored as a failed inspection', async () => {
    const nul = 'e1'.repeat(32)
    const surrogate = 'e2'.repeat(32)
    const escaped = 'e3'.repeat(32)
    const source = chainOf(1010, [
      at(1002, notification(1, REQUEST_A), nul),
      at(1003, notification(2, REQUEST_B), surrogate),
      at(1004, notification(3, REQUEST_C), escaped),
    ])
    const inspect: InspectTransaction = (raw, notifications) => {
      const inspection = inspectedWithoutCells(raw, notifications)
      if (raw === rawOf(nul)) {
        return { ...inspection, callChains: [callNode('send\u0000eposit')] }
      }
      return raw === rawOf(surrogate)
        ? { ...inspection, requests: { '2': { failed: 'cut \ud83d' } } }
        : { ...inspection, callChains: [callNode('send\\u0000eposit \\ud83d')] }
    }

    expect(await cycle(source, {}, inspect)).toMatchObject({ kind: 'stored', events: 3 })

    const failed = { failed: 'the inspection holds a character PostgreSQL refuses' }
    expect(await transactionsOf()).toMatchObject([
      { hash: bytes(nul), raw: bytes(rawOf(nul)), inspection: failed },
      { hash: bytes(surrogate), raw: bytes(rawOf(surrogate)), inspection: failed },
      {
        hash: bytes(escaped),
        inspection: { callChains: [callNode('send\\u0000eposit \\ud83d')] },
      },
    ])
    expect(await eventIds()).toEqual([1, 2, 3])
    expect(await stateOf()).toMatchObject({ cursor_height: 1008, last_error: null })
  })

  it('a thrown reason holding a NUL character is stored', async () => {
    const thrown = 'f1'.repeat(32)
    const returned = 'f2'.repeat(32)
    const source = chainOf(1010, [
      at(1002, notification(1, REQUEST_A), thrown),
      at(1003, notification(2, REQUEST_B), returned),
    ])
    const inspect: InspectTransaction = (raw) => {
      if (raw === rawOf(thrown)) {
        throw new Error(`no entry point send\u0000eposit ${'x'.repeat(1972)}\u{1f512}`)
      }
      return { failed: 'no entry point send\u0000eposit' }
    }

    expect(await cycle(source, {}, inspect)).toMatchObject({ kind: 'stored', events: 2 })

    expect(await transactionsOf()).toMatchObject([
      {
        hash: bytes(thrown),
        raw: bytes(rawOf(thrown)),
        inspection: { failed: `no entry point sendeposit ${'x'.repeat(1972)}` },
      },
      {
        hash: bytes(returned),
        raw: bytes(rawOf(returned)),
        inspection: { failed: 'no entry point sendeposit' },
      },
    ])
    expect(await eventIds()).toEqual([1, 2])
    expect(await stateOf()).toMatchObject({ cursor_height: 1008, last_error: null })
  })

  it('a failed cycle records its error without a NUL character', async () => {
    const source = chainOf(1010, [at(1002, notification(1))])
    expect(await cycle(source, { maxRange: 3 })).toMatchObject({ kind: 'stored' })
    source.failNextCall(new Error('the indexer answered \u0000'))

    const outcome = await cycle(source, { maxRange: 3 })

    expect(outcome).toEqual({ kind: 'failed', error: 'the indexer answered ' })
    expect(await stateOf()).toMatchObject({
      cursor_height: 1003,
      last_error: 'the indexer answered ',
    })
  })

  it('stores a transaction without a notification uninspected', async () => {
    const placed = [at(1002, signature(1)), at(1003, attestation(2))]
    const { source, rawFetches } = observed(chainOf(1010, placed))
    const { calls, inspect } = recordingInspect()

    expect(await cycle(source, {}, inspect)).toMatchObject({ kind: 'stored', events: 2 })

    expect(await transactionsOf()).toMatchObject([
      { hash: bytes(placed.map(transactionHashOf)[0] ?? ''), raw: null, inspection: null },
      { hash: bytes(placed.map(transactionHashOf)[1] ?? ''), raw: null, inspection: null },
    ])
    expect(rawFetches).toEqual([])
    expect(calls).toEqual([])
  })

  it('a transaction that cannot be fetched fails the cycle', async () => {
    const placed = [at(1002, notification(1)), at(1003, notification(2, REQUEST_B))]
    const missing = transactionHashOf(at(1003, notification(2, REQUEST_B)))

    const outcome = await cycle(chainOf(1010, placed, [missing]))

    const error = `the in-memory source holds no transaction ${missing}`
    expect(outcome).toEqual({ kind: 'failed', error })
    expect(await stateOf()).toMatchObject({ cursor_height: null, last_error: error })
    expect(await transactionsOf()).toEqual([])
    expect(await eventsOf()).toEqual([])
    expect(await requestsOf()).toEqual([])
  })

  it('the recorded error carries no query string', async () => {
    const source = chainOf(1010, [at(1002, notification(1))])
    expect(await cycle(source, { maxRange: 3 })).toMatchObject({ kind: 'stored' })
    source.failNextCall(
      new Error(
        `POST https://user:password@indexer.example/api/v0?project_id=SECRET#part failed: ${'x'.repeat(3000)}`,
      ),
    )

    const outcome = await cycle(source, { maxRange: 3 })

    const error = `POST https://indexer.example/api/v0 failed: ${'x'.repeat(3000)}`.slice(0, 2000)
    expect(outcome).toEqual({ kind: 'failed', error })
    expect(error).toHaveLength(2000)
    const state = await stateOf()
    expect(state.last_error).toBe(error)
    expect(state.last_error).not.toMatch(/SECRET|password|\?/)
    expect(state.cursor_height).toBe(1003)
  })
})
