import { connect } from 'node:net'

import { createExplorerApiClient, type ExplorerService } from '@sig-net/explorer-api'
import { MIDNIGHT_NETWORKS, type SignetContractEvent } from '@sig-net/explorer-lib'
import { notificationEvent, responseEvent } from '@sig-net/explorer-lib/testing'
import { MidnightNetwork, SignetEventName } from '@sig-net/midnight'
import { sql } from 'kysely'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  type BackendDependencies,
  type BackendLogEntry,
  type RunningBackend,
  startBackend,
  wipeNetwork,
} from './backend.ts'
import type { BackendConfig, BackendNetworkConfig } from './config/backend-env.ts'
import { migrateNetworkSchema, wipeNetworkSchema } from './db/migrate.ts'
import { networkDb, networkSchemaName } from './db/schema.ts'
import { createTestDatabase, type TestDatabase } from './db/testing.ts'
import type { IngestLoopSleep } from './ingest/ingest-loop.ts'
import {
  at,
  blockOf,
  chainOf,
  FIRST_BLOCK,
  GENESIS_HASH,
  inspectedWithoutCells,
  type PlacedEvent,
  SETTINGS,
} from './ingest/testing.ts'
import {
  createInMemoryMidnightSource,
  type InMemoryBlock,
  type InMemoryMidnightSource,
} from './source/in-memory.ts'
import type { MidnightSource } from './source/port.ts'

const PREPROD = MidnightNetwork.Preprod
const PREVIEW = MidnightNetwork.Preview
const TEST_TIMEOUT_MS = 60_000

const REQUEST_A = new Uint8Array(32).fill(0xa1)
const REQUEST_B = new Uint8Array(32).fill(0xb2)
const REQUEST_A_HEX = 'a1'.repeat(32)
const CALLER = new Uint8Array(32).fill(0xc1)
const CALLER_HEX = 'c1'.repeat(32)

/** One request notified, signed and attested in the blocks 1002 to 1004. */
const LIFECYCLE: readonly PlacedEvent[] = [
  at(1002, notification(1)),
  at(1003, responseEvent(2, SignetEventName.SignatureRespondedEvent, REQUEST_A, 0)),
  at(1004, responseEvent(3, SignetEventName.RespondBidirectionalEvent, REQUEST_A, 0)),
]

type Sources = Partial<Record<MidnightNetwork, MidnightSource>>

let database: TestDatabase
let entries: BackendLogEntry[]
let running: RunningBackend[]

beforeAll(async () => {
  database = await createTestDatabase()
})

afterAll(async () => {
  await database.drop()
})

beforeEach(async () => {
  entries = []
  running = []
  for (const network of MIDNIGHT_NETWORKS) {
    await wipeNetworkSchema(database.db, network)
  }
})

afterEach(async () => {
  await Promise.all(running.map((backend) => backend.stop()))
})

function notification(id: number, requestId = REQUEST_A): SignetContractEvent {
  return notificationEvent(id, requestId, CALLER, 0)
}

function networkConfig(network: MidnightNetwork): BackendNetworkConfig {
  return {
    network,
    config: {
      signerContractAddress: SETTINGS.signerContractAddress,
      responderContractAddress: SETTINGS.responderContractAddress,
      startBlock: FIRST_BLOCK,
      sourceUrl: 'https://indexer.example/api/v0',
    },
    pollIntervalSeconds: 1,
    tipMargin: 0,
    maxRange: 100,
  }
}

function configOf(...networks: readonly MidnightNetwork[]): BackendConfig {
  return {
    databaseUrl: database.url,
    host: '127.0.0.1',
    port: 0,
    corsOrigins: '*',
    networks: networks.map(networkConfig),
  }
}

/** Wakes the loop after 20 ms whatever the interval, or as soon as `signal` aborts. */
const shortSleep: IngestLoopSleep = (_ms, signal) =>
  new Promise((resolve) => {
    const wake = (): void => {
      clearTimeout(timer)
      signal.removeEventListener('abort', wake)
      resolve()
    }
    const timer = setTimeout(wake, 20)
    signal.addEventListener('abort', wake)
  })

async function start(
  config: BackendConfig,
  sources: Sources,
  migrate?: BackendDependencies['migrate'],
): Promise<RunningBackend> {
  const backend = await startBackend(config, {
    createSource: ({ network }) => {
      const source = sources[network]
      if (source === undefined) {
        throw new Error(`the test gave no source for ${network}`)
      }
      return source
    },
    inspect: inspectedWithoutCells,
    log: (entry) => {
      entries.push(entry)
    },
    sleep: shortSleep,
    ...(migrate === undefined ? {} : { migrate }),
  })
  running.push(backend)
  return backend
}

function baseUrlOf(backend: RunningBackend): string {
  return `http://127.0.0.1:${String(backend.port)}`
}

function clientOf(backend: RunningBackend): ExplorerService {
  return createExplorerApiClient({ baseUrl: baseUrlOf(backend) })
}

async function readyStatus(backend: RunningBackend): Promise<number> {
  const response = await fetch(`${baseUrlOf(backend)}/readyz`)
  await response.body?.cancel()
  return response.status
}

async function waitFor(what: string, holds: () => boolean | Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 45_000
  while (!(await holds())) {
    if (Date.now() > deadline) {
      throw new Error(`waited 45 s for ${what}: ${JSON.stringify(entries)}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

async function cursorOf(client: ExplorerService, network: MidnightNetwork): Promise<number | null> {
  const networks = await client.networks()
  return networks.find((served) => served.network === network)?.sync.processedBlock ?? null
}

function cursorReaches(
  client: ExplorerService,
  network: MidnightNetwork,
  height: number,
): Promise<void> {
  return waitFor(`the cursor of ${network} to reach ${String(height)}`, async () => {
    return (await cursorOf(client, network)) === height
  })
}

function entriesOf(message: string, network?: MidnightNetwork): BackendLogEntry[] {
  return entries.filter(
    (entry) => entry.message === message && (network === undefined || entry.network === network),
  )
}

function blocksTo(toHeight: number, placed: readonly PlacedEvent[]): InMemoryBlock[] {
  const blocks: InMemoryBlock[] = []
  for (let height = FIRST_BLOCK; height <= toHeight; height += 1) {
    blocks.push(blockOf(height, placed))
  }
  return blocks
}

async function storedEventCount(network: MidnightNetwork): Promise<number> {
  const { count } = await networkDb(database.db, network)
    .selectFrom('events')
    .select((expression) => expression.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow()
  return count
}

async function migrationTimes(network: MidnightNetwork): Promise<string[]> {
  const { rows } = await sql<{ applied: string }>`
    SELECT applied_at::text AS applied
    FROM ${sql.id(networkSchemaName(network), 'migrations')}
    ORDER BY name
  `.execute(database.db)
  return rows.map((row) => row.applied)
}

interface Deferred {
  readonly promise: Promise<void>
  resolve(): void
}

function deferred(): Deferred {
  let resolve = (): void => {}
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

/** `source`, whose every read of the genesis hash waits for `gate` once `held.on` is set. */
function heldSource(
  source: InMemoryMidnightSource,
  gate: Deferred,
  held: { on: boolean; waiting: boolean },
): MidnightSource {
  return {
    ...source,
    async genesisHash(): Promise<string> {
      if (held.on) {
        held.waiting = true
        await gate.promise
      }
      return source.genesisHash()
    },
  }
}

/**
 * A connection to `backend` that has received the answer of one `GET /readyz` and has sent the
 * start of a second, which `finish` completes.
 */
async function connectionWithRequestInFlight(
  backend: RunningBackend,
): Promise<{ firstStatus: number; finish(): Promise<number> }> {
  const socket = connect(backend.port, '127.0.0.1')
  let received = ''
  socket.setEncoding('utf8')
  socket.on('data', (chunk: string) => {
    received += chunk
  })
  const ended = new Promise<void>((resolve, reject) => {
    socket.once('close', () => {
      resolve()
    })
    socket.once('error', reject)
  })
  const request = 'GET /readyz HTTP/1.1\r\nHost: backend.test\r\n'
  // One write, so that the server reads the start of the second request with the whole first.
  socket.write(`${request}\r\n${request}`)
  await waitFor('the answer to the first request', () => received.includes('"status"'))
  const firstStatus = statusesOf(received)[0] ?? 0
  return {
    firstStatus,
    async finish(): Promise<number> {
      socket.write('Connection: close\r\n\r\n')
      await ended
      return statusesOf(received)[1] ?? 0
    },
  }
}

function statusesOf(received: string): number[] {
  return Array.from(received.matchAll(/HTTP\/1\.1 (\d{3})/gu), (match) => Number(match[1]))
}

describe('startBackend', () => {
  it(
    'indexes the in-memory chain and serves it through the api client',
    async () => {
      const backend = await start(configOf(PREPROD), { [PREPROD]: chainOf(1005, LIFECYCLE) })
      const client = clientOf(backend)

      await backend.started
      await cursorReaches(client, PREPROD, 1005)

      const page = await client.lifecycles(PREPROD)
      expect(page).toMatchObject({ totalRequests: 1, totalEvents: 3 })
      expect(page.lifecycles).toHaveLength(1)
      expect(page.lifecycles[0]).toMatchObject({ requestId: REQUEST_A_HEX, firstEventId: 1 })
      expect(page.lifecycles[0]?.signBidirectionalEvents).toHaveLength(1)
      expect(page.lifecycles[0]?.signatureRespondedEvents).toHaveLength(1)
      expect(page.lifecycles[0]?.respondBidirectionalEvents).toHaveLength(1)
      expect(await client.callers(PREPROD)).toEqual([CALLER_HEX])
      expect(entriesOf('listening')).toEqual([
        { level: 'info', message: 'listening', host: '127.0.0.1', port: backend.port },
      ])
      expect(entriesOf('stored blocks', PREPROD)).toEqual([
        {
          level: 'info',
          message: 'stored blocks',
          network: PREPROD,
          fromBlock: 1001,
          toBlock: 1005,
          events: 3,
        },
      ])
      await waitFor('the caught up entry', () => entriesOf('caught up', PREPROD).length > 0)
      await new Promise((resolve) => setTimeout(resolve, 200))
      expect(entriesOf('caught up', PREPROD)).toHaveLength(1)
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'serves what was stored before a restart and continues from the cursor',
    async () => {
      const source = chainOf(1005, LIFECYCLE)
      const first = await start(configOf(PREPROD), { [PREPROD]: source })
      await first.started
      await cursorReaches(clientOf(first), PREPROD, 1005)
      await first.stop()
      entries = []
      const later = [...LIFECYCLE, at(1006, notification(4, REQUEST_B))]
      source.appendBlock(blockOf(1006, later))

      const migration = deferred()
      const second = await start(configOf(PREPROD), { [PREPROD]: source }, async (db, network) => {
        await migration.promise
        await migrateNetworkSchema(db, network)
      })
      const client = clientOf(second)

      expect(await cursorOf(client, PREPROD)).toBe(1005)
      expect(
        (await client.lifecycles(PREPROD)).lifecycles.map(({ requestId }) => requestId),
      ).toEqual([REQUEST_A_HEX])

      migration.resolve()
      await cursorReaches(client, PREPROD, 1006)

      expect(entriesOf('stored blocks', PREPROD)).toEqual([
        expect.objectContaining({ fromBlock: 1006, toBlock: 1006, events: 1 }),
      ])
      expect(await client.lifecycles(PREPROD)).toMatchObject({ totalRequests: 2, totalEvents: 4 })
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'one network that stops leaves the other indexing',
    async () => {
      const config = configOf(PREPROD, PREVIEW)
      const preview = chainOf(1005, LIFECYCLE)
      const first = await start(config, { [PREPROD]: chainOf(1005, LIFECYCLE), [PREVIEW]: preview })
      await first.started
      await cursorReaches(clientOf(first), PREPROD, 1005)
      await cursorReaches(clientOf(first), PREVIEW, 1005)
      await first.stop()
      entries = []

      const otherGenesis = '77'.repeat(32)
      const second = await start(config, {
        [PREPROD]: createInMemoryMidnightSource(otherGenesis, blocksTo(1008, LIFECYCLE)),
        [PREVIEW]: preview,
      })
      const client = clientOf(second)
      await second.started
      await waitFor('preprod to stop', () => entriesOf('the network stopped', PREPROD).length > 0)
      const later = [...LIFECYCLE, at(1006, notification(4, REQUEST_B))]
      preview.appendBlock(blockOf(1006, later))
      await cursorReaches(client, PREVIEW, 1006)

      expect(entriesOf('the network stopped', PREPROD)[0]).toEqual({
        level: 'error',
        message: 'the network stopped',
        network: PREPROD,
        reason: `the source's genesis hash is ${otherGenesis} and the schema was indexed for ${GENESIS_HASH}`,
      })
      const networks = await client.networks()
      expect(
        networks.map(({ network, sync }) => [network, sync.state, sync.processedBlock]),
      ).toEqual([
        [PREPROD, 'stopped', 1005],
        [PREVIEW, 'synced', 1006],
      ])
      expect(await storedEventCount(PREVIEW)).toBe(4)
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'readyz turns 200 after the migrations',
    async () => {
      const migration = deferred()
      const cycle = deferred()
      const held = { on: false, waiting: false }
      const backend = await start(
        configOf(PREPROD),
        { [PREPROD]: heldSource(chainOf(1005, LIFECYCLE), cycle, held) },
        async (db, network) => {
          await migration.promise
          await migrateNetworkSchema(db, network)
        },
      )

      expect(await readyStatus(backend)).toBe(503)

      migration.resolve()
      await backend.started
      expect(await readyStatus(backend)).toBe(200)

      held.on = true
      await waitFor('a cycle to be in flight', () => held.waiting)
      const connection = await connectionWithRequestInFlight(backend)
      expect(connection.firstStatus).toBe(200)
      const stopping = backend.stop()

      expect(await connection.finish()).toBe(503)

      cycle.resolve()
      await stopping
      await expect(readyStatus(backend)).rejects.toThrow('fetch failed')
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'wipe-network drops one schema and the loop indexes it again',
    async () => {
      const config = configOf(PREPROD, PREVIEW)
      const backend = await start(config, {
        [PREPROD]: chainOf(1005, LIFECYCLE),
        [PREVIEW]: chainOf(1005, LIFECYCLE),
      })
      const client = clientOf(backend)
      await backend.started
      await cursorReaches(client, PREPROD, 1005)
      await cursorReaches(client, PREVIEW, 1005)
      const preprodMigratedAt = await migrationTimes(PREPROD)
      const previewMigratedAt = await migrationTimes(PREVIEW)

      expect(await wipeNetwork(config, 'preprod')).toBe('midnight_preprod')

      await waitFor(
        'preprod to be stored a second time',
        () => entriesOf('stored blocks', PREPROD).length === 2,
      )
      expect(entriesOf('stored blocks', PREPROD)[1]).toMatchObject({
        fromBlock: 1001,
        toBlock: 1005,
        events: 3,
      })
      expect(await client.lifecycles(PREPROD)).toMatchObject({ totalRequests: 1, totalEvents: 3 })
      expect(await migrationTimes(PREPROD)).not.toEqual(preprodMigratedAt)
      expect(await migrationTimes(PREVIEW)).toEqual(previewMigratedAt)
      expect(await storedEventCount(PREVIEW)).toBe(3)
      expect(entriesOf('stored blocks', PREVIEW)).toHaveLength(1)
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'wipe-network of an unknown network drops nothing',
    async () => {
      const config = configOf(PREPROD, PREVIEW)
      const backend = await start(config, {
        [PREPROD]: chainOf(1005, LIFECYCLE),
        [PREVIEW]: chainOf(1005, LIFECYCLE),
      })
      await backend.started
      await cursorReaches(clientOf(backend), PREPROD, 1005)
      await cursorReaches(clientOf(backend), PREVIEW, 1005)
      await backend.stop()
      const migratedAt = [await migrationTimes(PREPROD), await migrationTimes(PREVIEW)]

      for (const argument of ['mainnet', 'midnight_preprod', '']) {
        await expect(wipeNetwork(config, argument)).rejects.toThrow(
          `${JSON.stringify(argument)} is not a configured network: the configured networks are preprod, preview`,
        )
      }

      expect([await migrationTimes(PREPROD), await migrationTimes(PREVIEW)]).toEqual(migratedAt)
      expect([await storedEventCount(PREPROD), await storedEventCount(PREVIEW)]).toEqual([3, 3])
    },
    TEST_TIMEOUT_MS,
  )

  it(
    "no log line carries a URL's query string",
    async () => {
      const failure = new Error(
        'POST https://user:password@indexer.test/api?project_id=secret answered 500',
      )
      const backend = await start(configOf(PREPROD), { [PREPROD]: chainOf(1005, LIFECYCLE) }, () =>
        Promise.reject(failure),
      )

      await expect(backend.started).rejects.toBe(failure)

      const logged = JSON.stringify(entries)
      expect(entriesOf('the migration failed')).toEqual([
        {
          level: 'error',
          message: 'the migration failed',
          network: PREPROD,
          error: 'POST https://indexer.test/api answered 500',
        },
      ])
      expect(logged).not.toContain('project_id')
      expect(logged).not.toContain('secret')
      expect(logged).not.toContain('password')
      expect(entriesOf('shut down')).toHaveLength(1)
      await expect(readyStatus(backend)).rejects.toThrow('fetch failed')
    },
    TEST_TIMEOUT_MS,
  )
})
