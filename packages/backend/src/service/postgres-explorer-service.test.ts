import { createHash } from 'node:crypto'

import {
  ExplorerApiError,
  type ExplorerNetworkSync,
  type ExplorerService,
  type LifecyclePage,
  type LifecyclesQuery,
} from '@sig-net/explorer-api'
import {
  createInMemoryExplorerService,
  EXPLORER_SEED_CASES,
  explorerSeed,
} from '@sig-net/explorer-api/testing'
import type { SignetContractEvent } from '@sig-net/explorer-lib'
import {
  indexedSignetContractEvent,
  notificationEvent,
  responseEvent,
} from '@sig-net/explorer-lib/testing'
import { MidnightNetwork, parseRequestIdHex, SignetEventName } from '@sig-net/midnight'
import { sql } from 'kysely'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { migrateNetworkSchema, wipeNetworkSchema } from '../db/migrate.ts'
import { networkSchemaName } from '../db/schema.ts'
import {
  createTestDatabase,
  seedNetworkEvents,
  storedInspectionsOfSeed,
  type TestDatabase,
} from '../db/testing.ts'
import { createPostgresExplorerService } from './postgres-explorer-service.ts'

const PREPROD = MidnightNetwork.Preprod
const PREVIEW = MidnightNetwork.Preview

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
})

afterAll(async () => {
  await database.drop()
})

beforeEach(async () => {
  for (const network of [PREPROD, PREVIEW]) {
    await wipeNetworkSchema(database.db, network)
    await migrateNetworkSchema(database.db, network)
  }
})

const servedNetworks = explorerSeed.networks.map(({ network, config }) => ({ network, config }))

function service(): ExplorerService {
  return createPostgresExplorerService(database.db, servedNetworks)
}

async function writeSync(network: MidnightNetwork, sync: ExplorerNetworkSync): Promise<void> {
  await sql`
    INSERT INTO ${sql.id(networkSchemaName(network), 'ingest_state')} (
      genesis_hash, signer_address, responder_address, start_block,
      cursor_height, cursor_hash, cursor_block_time, tip_height, state, last_success_at, last_error
    )
    VALUES (
      '\\x00', '\\x01', '\\x02', 0,
      ${sync.processedBlock},
      ${sync.processedBlock === null ? null : Buffer.from('cc'.repeat(32), 'hex')},
      ${sync.processedBlockTime},
      ${sync.tipBlock},
      ${sync.state},
      ${sync.lastSuccessAt},
      ${sync.error}
    )
  `.execute(database.db)
}

/** A request id or caller address that looks random, distinct for each `label`. */
function randomHex(label: string): string {
  return createHash('sha256').update(label).digest('hex')
}

function bytes(hex: string): Uint8Array {
  return Buffer.from(hex, 'hex')
}

async function seed(events: readonly SignetContractEvent[]): Promise<void> {
  await seedNetworkEvents(database.db, PREPROD, events, new Map())
}

function requestIds(page: LifecyclePage): string[] {
  return page.lifecycles.map((lifecycle) => lifecycle.requestId)
}

describe('the query service over PostgreSQL', () => {
  it('answers as the in-memory service for the shared seed', async () => {
    const [preprodSeed] = explorerSeed.networks
    if (preprodSeed === undefined) {
      throw new Error('the shared seed has no preprod network')
    }
    await seedNetworkEvents(
      database.db,
      PREPROD,
      preprodSeed.events,
      storedInspectionsOfSeed(preprodSeed),
    )
    await writeSync(PREPROD, preprodSeed.sync)
    const expected = createInMemoryExplorerService(explorerSeed)
    const actual = service()

    expect(await actual.networks()).toEqual(await expected.networks())
    for (const network of [PREPROD, PREVIEW]) {
      expect(await actual.callers(network)).toEqual(await expected.callers(network))
    }
    const requestIdsOfSeed = [
      EXPLORER_SEED_CASES.completeRequestId,
      EXPLORER_SEED_CASES.responseWithoutRequestId,
      EXPLORER_SEED_CASES.notifiedTwiceRequestId,
      EXPLORER_SEED_CASES.failedInspectionRequestId,
      EXPLORER_SEED_CASES.attestationWithoutRequestId,
      EXPLORER_SEED_CASES.notInspectedRequestId,
      'a9'.repeat(32),
    ]
    for (const requestId of requestIdsOfSeed) {
      const id = parseRequestIdHex(requestId)
      if (id === null) {
        throw new Error(`${requestId} is not a request id`)
      }
      expect(await actual.lifecycle(PREPROD, id)).toEqual(await expected.lifecycle(PREPROD, id))
    }
    const searches = [
      '',
      'c2',
      '%',
      '%%%',
      '_',
      '___',
      '\\',
      '\\\\\\',
      `0X${EXPLORER_SEED_CASES.completeCaller.slice(10, 22).toUpperCase()}`,
      `  ${EXPLORER_SEED_CASES.notifiedTwiceRequestId.toUpperCase()} `,
      EXPLORER_SEED_CASES.completeRequestId,
      EXPLORER_SEED_CASES.notifiedTwiceCallers[1].slice(0, 8),
      'b1b1b1',
      'zzz',
    ]
    const exclusions = [
      [],
      [EXPLORER_SEED_CASES.completeCaller],
      [...EXPLORER_SEED_CASES.notifiedTwiceCallers],
      [`0x${EXPLORER_SEED_CASES.failedInspectionCaller.toUpperCase()}`],
    ]
    for (const network of [PREPROD, PREVIEW]) {
      for (const search of searches) {
        for (const excludeCallers of exclusions) {
          for (const limit of [1, 2, 3, undefined]) {
            let before: number | undefined
            for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
              const query: LifecyclesQuery = { search, excludeCallers, limit, before }
              const page = await actual.lifecycles(network, query)
              expect(page, JSON.stringify(query)).toEqual(
                await expected.lifecycles(network, query),
              )
              if (page.nextBefore === null) {
                break
              }
              before = page.nextBefore
            }
          }
        }
      }
    }
  })

  it('pages through 500 requests without repeating or skipping one', async () => {
    const ids = Array.from({ length: 500 }, (_, index) => randomHex(`request ${index}`))
    await seed(
      ids.map((id, index) =>
        notificationEvent(index + 1, bytes(id), bytes(randomHex(`caller ${index % 7}`)), index),
      ),
    )

    const served: string[] = []
    let before: number | undefined
    let pages = 0
    for (;;) {
      const page = await service().lifecycles(PREPROD, { limit: 7, before })
      pages++
      served.push(...requestIds(page))
      if (page.nextBefore === null) {
        break
      }
      before = page.nextBefore
    }

    expect(pages).toBe(Math.ceil(500 / 7))
    expect(served).toEqual(ids.toReversed())
  })

  it('search matches a fragment in any case with or without 0x', async () => {
    const [first, second, third] = ['one', 'two', 'three'].map((label) => randomHex(label))
    const caller = randomHex('caller')
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('three request ids were not made')
    }
    await seed([
      notificationEvent(1, bytes(first), bytes(caller), 1),
      notificationEvent(2, bytes(second), bytes(randomHex('other caller')), 2),
      responseEvent(3, SignetEventName.SignatureRespondedEvent, bytes(third), 3),
    ])
    const search = async (text: string): Promise<string[]> =>
      requestIds(await service().lifecycles(PREPROD, { search: text }))

    for (const fragment of [second.slice(20, 32), second]) {
      expect(await search(fragment)).toEqual([second])
      expect(await search(fragment.toUpperCase())).toEqual([second])
      expect(await search(`0x${fragment}`)).toEqual([second])
      expect(await search(`0X${fragment.toUpperCase()}`)).toEqual([second])
    }
    expect(await search(`0x${caller.slice(30, 42).toUpperCase()}`)).toEqual([first])
    expect(await search(third.slice(0, 12))).toEqual([third])
  })

  it('search treats percent, underscore and backslash as text', async () => {
    const ids = ['ab', 'cd', 'ef'].map((label) => `${label}${randomHex(label).slice(2)}`)
    await seed(
      ids.map((id, index) =>
        notificationEvent(index + 1, bytes(id), bytes(randomHex(`caller ${index}`)), index),
      ),
    )

    for (const search of ['%%%', '___', '\\\\\\', 'ab%', 'ab_', 'a__', '%ab', 'ab\\', 'a%b%']) {
      const page = await service().lifecycles(PREPROD, { search })
      expect(page.lifecycles, search).toEqual([])
      expect(page.matchingRequests, search).toBe(0)
    }
  })

  it('excluding callers keeps requests that name no caller', async () => {
    const [withX, withY, withNone, withBoth] = ['x', 'y', 'none', 'both'].map((label) =>
      randomHex(`request ${label}`),
    )
    const [callerX, callerY] = [randomHex('caller x'), randomHex('caller y')]
    if (
      withX === undefined ||
      withY === undefined ||
      withNone === undefined ||
      withBoth === undefined ||
      callerX === undefined ||
      callerY === undefined
    ) {
      throw new Error('the request ids were not made')
    }
    await seed([
      notificationEvent(1, bytes(withX), bytes(callerX), 1),
      notificationEvent(2, bytes(withY), bytes(callerY), 2),
      responseEvent(3, SignetEventName.SignatureRespondedEvent, bytes(withNone), 3),
      notificationEvent(4, bytes(withBoth), bytes(callerX), 4),
      notificationEvent(5, bytes(withBoth), bytes(callerY), 5),
    ])
    const excluding = async (callers: string[]): Promise<string[]> =>
      requestIds(await service().lifecycles(PREPROD, { excludeCallers: callers }))

    expect(await excluding([callerX])).toEqual([withNone, withY])
    expect(await excluding([callerY])).toEqual([withNone, withX])
    expect(await excluding([callerX, callerY])).toEqual([withNone])
    expect(await excluding([])).toEqual([withBoth, withNone, withY, withX])
  })

  it('counts the matching requests and events and the totals', async () => {
    const [notified, signed, attested] = ['notified', 'signed', 'attested'].map((label) =>
      randomHex(label),
    )
    const caller = randomHex('caller')
    if (notified === undefined || signed === undefined || attested === undefined) {
      throw new Error('the request ids were not made')
    }
    await seed([
      indexedSignetContractEvent(1, 'signer', 'SomeOtherEvent', [], 1),
      notificationEvent(2, bytes(notified), bytes(caller), 2),
      notificationEvent(3, bytes(signed), bytes(caller), 3),
      responseEvent(4, SignetEventName.SignatureRespondedEvent, bytes(signed), 4),
      responseEvent(5, SignetEventName.SignatureRespondedEvent, bytes(attested), 5),
      responseEvent(6, SignetEventName.RespondBidirectionalEvent, bytes(attested), 6),
      responseEvent(7, SignetEventName.RespondBidirectionalEvent, bytes(signed), 7),
      indexedSignetContractEvent(8, 'signer', SignetEventName.SignBidirectionalEvent, [0], 8),
    ])

    const all = await service().lifecycles(PREPROD, { limit: 1 })
    const byCaller = await service().lifecycles(PREPROD, { search: caller.slice(4, 16) })
    const bySigned = await service().lifecycles(PREPROD, { search: signed })
    const excluded = await service().lifecycles(PREPROD, { excludeCallers: [caller] })
    const counts = ({
      matchingRequests,
      matchingEvents,
      totalRequests,
      totalEvents,
    }: LifecyclePage): number[] => [matchingRequests, matchingEvents, totalRequests, totalEvents]

    expect(counts(all)).toEqual([3, 6, 3, 8])
    expect(all.lifecycles).toHaveLength(1)
    expect(counts(byCaller)).toEqual([2, 4, 3, 8])
    expect(counts(bySigned)).toEqual([1, 3, 3, 8])
    expect(counts(excluded)).toEqual([1, 2, 3, 8])
  })

  it('reports starting, syncing, synced and stopped', async () => {
    const syncOf = async (network: MidnightNetwork): Promise<ExplorerNetworkSync | undefined> =>
      (await service().networks()).find((served) => served.network === network)?.sync
    const states: ExplorerNetworkSync[] = [
      {
        state: 'syncing',
        processedBlock: 120,
        processedBlockTime: new Date('2026-09-07T12:00:00.000Z'),
        tipBlock: 400,
        lastSuccessAt: new Date('2026-09-07T12:00:05.000Z'),
        error: null,
      },
      {
        state: 'synced',
        processedBlock: 400,
        processedBlockTime: new Date('2026-09-07T12:30:00.000Z'),
        tipBlock: 400,
        lastSuccessAt: new Date('2026-09-07T12:30:02.000Z'),
        error: null,
      },
      {
        state: 'stopped',
        processedBlock: 400,
        processedBlockTime: new Date('2026-09-07T12:30:00.000Z'),
        tipBlock: 410,
        lastSuccessAt: new Date('2026-09-07T12:30:02.000Z'),
        error: 'the indexer at https://indexer.example/graphql?project_id=token answered 503',
      },
    ]

    expect(await syncOf(PREPROD)).toEqual({
      state: 'starting',
      processedBlock: null,
      processedBlockTime: null,
      tipBlock: null,
      lastSuccessAt: null,
      error: null,
    })
    for (const sync of states) {
      await sql`DELETE FROM ${sql.id(networkSchemaName(PREPROD), 'ingest_state')}`.execute(
        database.db,
      )
      await writeSync(PREPROD, sync)
      expect(await syncOf(PREPROD)).toEqual(sync)
    }
  })

  it('an unknown network is the typed error', async () => {
    const preprodOnly = createPostgresExplorerService(
      database.db,
      servedNetworks.filter((served) => served.network === PREPROD),
    )
    const requestId = parseRequestIdHex(EXPLORER_SEED_CASES.completeRequestId)
    if (requestId === null) {
      throw new Error('the seed request id does not parse')
    }
    const calls: (() => Promise<unknown>)[] = [
      () => preprodOnly.lifecycles(PREVIEW),
      () => preprodOnly.lifecycles(PREVIEW, { limit: 0 }),
      () => preprodOnly.lifecycle(PREVIEW, requestId),
      () => preprodOnly.callers(PREVIEW),
    ]

    expect((await preprodOnly.networks()).map((served) => served.network)).toEqual([PREPROD])
    for (const call of calls) {
      const error = await call().then(
        () => null,
        (reason: unknown) => reason,
      )
      expect(error).toBeInstanceOf(ExplorerApiError)
      expect(error).toHaveProperty('code', 'unknown_network')
    }
  })
})
