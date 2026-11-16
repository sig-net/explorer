import {
  lifecycleFromWire,
  lifecycleToWire,
  lifecycleWireSchema,
  type RequestCellWire,
} from '@sig-net/explorer-api'
import {
  createInMemoryExplorerService,
  explorerSeed,
  PREPROD_REQUEST_CELL_WIRE,
} from '@sig-net/explorer-api/testing'
import { MIDNIGHT_NETWORKS, type SignetContractEvent } from '@sig-net/explorer-lib'
import { notificationEvent, responseEvent } from '@sig-net/explorer-lib/testing'
import { MidnightNetwork, parseRequestIdHex, SignetEventName } from '@sig-net/midnight'
import { type RawBuilder, sql } from 'kysely'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { migrateNetworkSchema, wipeNetworkSchema } from './migrate.ts'
import { networkDb, networkSchemaName, type StoredInspection } from './schema.ts'
import { createTestDatabase, type TestDatabase } from './testing.ts'

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
  for (const network of MIDNIGHT_NETWORKS) {
    await wipeNetworkSchema(database.db, network)
  }
})

function table(network: MidnightNetwork, name: string): RawBuilder<unknown> {
  return sql.id(networkSchemaName(network), name)
}

async function schemaNames(): Promise<string[]> {
  const { rows } = await sql<{ nspname: string }>`
    SELECT nspname FROM pg_namespace WHERE nspname LIKE 'midnight%' ORDER BY nspname
  `.execute(database.db)
  return rows.map((row) => row.nspname)
}

/** Every relation, column and index of the network's schema, with what the migrations recorded. */
async function schemaSnapshot(network: MidnightNetwork): Promise<unknown> {
  const schema = networkSchemaName(network)
  const columns = await sql`
    SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = ${schema} ORDER BY table_name, ordinal_position
  `.execute(database.db)
  const indexes = await sql`
    SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = ${schema} ORDER BY indexname
  `.execute(database.db)
  const migrations = await sql`
    SELECT name, applied_at FROM ${table(network, 'migrations')} ORDER BY name
  `.execute(database.db)
  return { columns: columns.rows, indexes: indexes.rows, migrations: migrations.rows }
}

/**
 * Stores `events` with one transaction per transaction hash, inspected as `inspections` says by
 * hash, and the request rows those events add up to.
 */
async function seedEvents(
  network: MidnightNetwork,
  events: readonly SignetContractEvent[],
  inspections: ReadonlyMap<string, StoredInspection>,
): Promise<void> {
  const seen = new Set<string>()
  for (const event of events) {
    const { source } = event
    if (!seen.has(source.transactionHash)) {
      seen.add(source.transactionHash)
      const inspection = inspections.get(source.transactionHash)
      await sql`
        INSERT INTO ${table(network, 'transactions')}
          (hash, block_height, block_hash, block_time, inspection)
        VALUES (
          decode(${source.transactionHash}, 'hex'),
          ${source.blockHeight},
          decode(${source.blockHash}, 'hex'),
          ${source.blockTimestamp},
          ${inspection === undefined ? null : JSON.stringify(inspection)}::jsonb
        )
      `.execute(database.db)
    }
    await sql`
      INSERT INTO ${table(network, 'events')}
        (id, transaction_hash, contract_roles, name, payload, request_id, decode_failure)
      VALUES (
        ${source.id},
        decode(${source.transactionHash}, 'hex'),
        ${[...event.roles]}::text[],
        ${source.name},
        ${Buffer.from(source.payload)},
        ${event.kind === 'decoded' ? event.requestId : null},
        ${event.kind === 'undecodable' ? event.reason : null}
      )
    `.execute(database.db)
  }
  await sql`
    INSERT INTO ${table(network, 'requests')} (
      request_id, first_event_id, first_requested_at, first_signature_at, first_response_at,
      sign_bidirectional_count, signature_responded_count, respond_bidirectional_count
    )
    SELECT
      e.request_id,
      min(e.id),
      min(t.block_time) FILTER (WHERE e.name = 'SignBidirectionalEvent'),
      min(t.block_time) FILTER (WHERE e.name = 'SignatureRespondedEvent'),
      min(t.block_time) FILTER (WHERE e.name = 'RespondBidirectionalEvent'),
      count(*) FILTER (WHERE e.name = 'SignBidirectionalEvent'),
      count(*) FILTER (WHERE e.name = 'SignatureRespondedEvent'),
      count(*) FILTER (WHERE e.name = 'RespondBidirectionalEvent')
    FROM ${table(network, 'events')} e
    JOIN ${table(network, 'transactions')} t ON t.hash = e.transaction_hash
    WHERE e.request_id IS NOT NULL
    GROUP BY e.request_id
  `.execute(database.db)
}

/** The same event, emitted by `transactionHash` in the block of `block`. */
function inTransactionOf(
  event: SignetContractEvent,
  block: SignetContractEvent,
): SignetContractEvent {
  const { transactionHash, blockHeight, blockHash, blockTimestamp } = block.source
  return {
    ...event,
    source: { ...event.source, transactionHash, blockHeight, blockHash, blockTimestamp },
  }
}

describe('a network schema', () => {
  it('migrating twice changes nothing', async () => {
    await Promise.all([
      migrateNetworkSchema(database.db, PREPROD),
      migrateNetworkSchema(database.db, PREPROD),
    ])
    const first = await schemaSnapshot(PREPROD)

    await migrateNetworkSchema(database.db, PREPROD)

    expect(await schemaSnapshot(PREPROD)).toEqual(first)
    expect(first).toMatchObject({ migrations: [{ name: '0001_network_tables.sql' }] })
  })

  it('two networks get separate schemas', async () => {
    await Promise.all([
      migrateNetworkSchema(database.db, PREPROD),
      migrateNetworkSchema(database.db, PREVIEW),
    ])
    await seedEvents(
      PREPROD,
      [responseEvent(1, SignetEventName.SignatureRespondedEvent, new Uint8Array(32).fill(1), 1)],
      new Map(),
    )

    expect(await schemaNames()).toEqual(['midnight_preprod', 'midnight_preview'])
    const preprod = await networkDb(database.db, PREPROD)
      .selectFrom('events')
      .select('id')
      .execute()
    const preview = await networkDb(database.db, PREVIEW)
      .selectFrom('events')
      .select('id')
      .execute()
    expect(preprod).toEqual([{ id: 1 }])
    expect(preview).toEqual([])
  })

  it('wiping one network leaves the other untouched', async () => {
    await migrateNetworkSchema(database.db, PREPROD)
    await migrateNetworkSchema(database.db, PREVIEW)
    const event = responseEvent(
      1,
      SignetEventName.SignatureRespondedEvent,
      new Uint8Array(32).fill(1),
      1,
    )
    await seedEvents(PREPROD, [event], new Map())
    await seedEvents(PREVIEW, [event], new Map())
    const previewBefore = await schemaSnapshot(PREVIEW)

    await wipeNetworkSchema(database.db, PREPROD)

    expect(await schemaNames()).toEqual(['midnight_preview'])
    expect(await schemaSnapshot(PREVIEW)).toEqual(previewBefore)
    const preview = await networkDb(database.db, PREVIEW)
      .selectFrom('lifecycle')
      .select('request_id')
      .execute()
    expect(preview).toEqual([{ request_id: '01'.repeat(32) }])
    const extensions = await sql`
      SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
    `.execute(database.db)
    expect(extensions.rows).toHaveLength(1)
  })
})

describe('the lifecycle view', () => {
  it('a lifecycle view row satisfies the wire schema', async () => {
    const seed = explorerSeed.networks.find((network) => network.network === PREPROD)
    if (seed === undefined) {
      throw new Error('the seed of the api package holds no preprod network')
    }
    const inspections = new Map<string, StoredInspection>()
    for (const { source } of seed.events) {
      const inspection = seed.inspections.get(source.id)
      if (inspection !== undefined) {
        inspections.set(
          source.transactionHash,
          'failed' in inspection
            ? inspection
            : {
                callChains: inspection.callChains,
                requestCells: { [String(source.id)]: inspection.requestCell },
              },
        )
      }
    }
    const service = createInMemoryExplorerService(explorerSeed)
    const expected = (await service.lifecycles(PREPROD)).lifecycles
    await migrateNetworkSchema(database.db, PREPROD)
    await seedEvents(PREPROD, seed.events, inspections)

    const rows = await networkDb(database.db, PREPROD)
      .selectFrom('lifecycle')
      .selectAll()
      .orderBy('first_event_id', 'desc')
      .execute()

    expect(expected.length).toBeGreaterThan(0)
    expect(rows.map((row) => row.request_id)).toEqual(expected.map(({ requestId }) => requestId))
    for (const row of rows) {
      const lifecycle = await service.lifecycle(PREPROD, parseRequestIdHex(row.request_id))
      if (lifecycle === null) {
        throw new Error(`the seed holds no request ${row.request_id}`)
      }
      const served: unknown = {
        requestId: row.request_id,
        firstEventId: row.first_event_id,
        events: row.events,
      }
      // The in-memory service keeps a cell that does not decode as a failed inspection, and the
      // view serves the cell as it is stored.
      const wire = lifecycleToWire(lifecycle)
      expect(served).toEqual({
        ...wire,
        events: wire.events.map((event) =>
          'inspection' in event
            ? {
                ...event,
                inspection: seed.inspections.get(event.id) ?? { failed: 'not inspected' },
              }
            : event,
        ),
      })
      expect(lifecycleFromWire(lifecycleWireSchema.parse(served))).toEqual(lifecycle)
    }
  })

  it('the view gives each request of one transaction its own record', async () => {
    const firstRequestId = 'a1'.repeat(32)
    const secondRequestId = 'a2'.repeat(32)
    const caller = new Uint8Array(32).fill(0xc0)
    const first = notificationEvent(1, Buffer.from(firstRequestId, 'hex'), caller, 1)
    const second = inTransactionOf(
      notificationEvent(2, Buffer.from(secondRequestId, 'hex'), caller, 1),
      first,
    )
    const secondCell: RequestCellWire = {
      ...PREPROD_REQUEST_CELL_WIRE,
      value: PREPROD_REQUEST_CELL_WIRE.value.map((atom, index) => (index === 0 ? '02' : atom)),
    }
    await migrateNetworkSchema(database.db, PREPROD)
    await seedEvents(
      PREPROD,
      [first, second],
      new Map([
        [
          first.source.transactionHash,
          { callChains: [], requestCells: { '1': PREPROD_REQUEST_CELL_WIRE, '2': secondCell } },
        ],
      ]),
    )

    const rows = await networkDb(database.db, PREPROD)
      .selectFrom('lifecycle')
      .select(['request_id', 'events'])
      .orderBy('first_event_id')
      .execute()

    expect(secondCell).not.toEqual(PREPROD_REQUEST_CELL_WIRE)
    expect(rows.map((row) => [row.request_id, row.events])).toEqual([
      [
        firstRequestId,
        [
          expect.objectContaining({
            id: 1,
            transactionHash: first.source.transactionHash,
            inspection: { callChains: [], requestCell: PREPROD_REQUEST_CELL_WIRE },
          }),
        ],
      ],
      [
        secondRequestId,
        [
          expect.objectContaining({
            id: 2,
            transactionHash: first.source.transactionHash,
            inspection: { callChains: [], requestCell: secondCell },
          }),
        ],
      ],
    ])
  })

  it('the view lists a response that has no request', async () => {
    const requestId = 'b1'.repeat(32)
    const response = responseEvent(
      7,
      SignetEventName.RespondBidirectionalEvent,
      Buffer.from(requestId, 'hex'),
      7,
    )
    await migrateNetworkSchema(database.db, PREPROD)
    await seedEvents(PREPROD, [response], new Map())

    const rows = await networkDb(database.db, PREPROD).selectFrom('lifecycle').selectAll().execute()

    expect(rows).toEqual([
      {
        request_id: requestId,
        first_event_id: 7,
        caller: null,
        first_requested_at: null,
        first_signature_at: null,
        first_response_at: response.source.blockTimestamp,
        sign_bidirectional_count: 0,
        signature_responded_count: 0,
        respond_bidirectional_count: 1,
        events: [
          {
            id: 7,
            name: SignetEventName.RespondBidirectionalEvent,
            payload: Buffer.from(response.source.payload).toString('hex'),
            transactionHash: response.source.transactionHash,
            blockHeight: response.source.blockHeight,
            blockHash: response.source.blockHash,
            blockTime: response.source.blockTimestamp.toISOString(),
            roles: ['responder'],
          },
        ],
      },
    ])
  })

  it('the list query reads no table in full', { timeout: 120_000 }, async () => {
    await migrateNetworkSchema(database.db, PREPROD)
    await sql`
      INSERT INTO ${table(PREPROD, 'transactions')} (hash, block_height, block_hash, block_time)
      SELECT
        decode(lpad(to_hex(n), 64, '0'), 'hex'),
        n,
        decode(lpad(to_hex(n), 64, 'b'), 'hex'),
        timestamptz '2026-09-07T12:00:00Z' + n * interval '6 seconds'
      FROM generate_series(1, 60000) AS n
    `.execute(database.db)
    await sql`
      INSERT INTO ${table(PREPROD, 'events')}
        (id, transaction_hash, contract_roles, name, payload, request_id)
      SELECT
        n,
        decode(lpad(to_hex(n), 64, '0'), 'hex'),
        ARRAY[CASE n % 3 WHEN 1 THEN 'signer' ELSE 'responder' END],
        CASE n % 3
          WHEN 1 THEN 'SignBidirectionalEvent'
          WHEN 2 THEN 'SignatureRespondedEvent'
          ELSE 'RespondBidirectionalEvent'
        END,
        '\\x00',
        'aa' || lpad(to_hex((n + 2) / 3), 62, '0')
      FROM generate_series(1, 60000) AS n
    `.execute(database.db)
    await sql`
      INSERT INTO ${table(PREPROD, 'requests')} (request_id, first_event_id, caller)
      SELECT 'aa' || lpad(to_hex(n), 62, '0'), n * 3 - 2, lpad(to_hex(n % 7), 64, 'c')
      FROM generate_series(1, 20000) AS n
    `.execute(database.db)
    await sql`ANALYZE`.execute(database.db)

    const newest = networkDb(database.db, PREPROD)
      .selectFrom('lifecycle')
      .selectAll()
      .orderBy('first_event_id', 'desc')
      .limit(50)
    const rows = await newest.execute()
    const plan = (await newest.explain()).map((line) => line['QUERY PLAN']).join('\n')

    expect(rows).toHaveLength(50)
    expect(rows[0]?.first_event_id).toBe(59998)
    expect(rows.every((row) => row.events.length === 3)).toBe(true)
    expect(plan).toContain('Index Scan')
    expect(plan).not.toContain('Seq Scan')
  })
})
