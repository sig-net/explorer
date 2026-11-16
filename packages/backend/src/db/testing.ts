import { randomBytes } from 'node:crypto'

import type { ExplorerSeedNetwork } from '@sig-net/explorer-api/testing'
import type { SignetContractEvent } from '@sig-net/explorer-lib'
import { type MidnightNetwork, SignetEventName } from '@sig-net/midnight'
import { type RawBuilder, sql } from 'kysely'

import { type ExplorerDatabase, openDatabase } from './database.ts'
import { networkDb, networkSchemaName, type StoredInspection } from './schema.ts'

export interface TestDatabase {
  readonly db: ExplorerDatabase
  /** The connection URL of the database `db` is open on. */
  readonly url: string
  /** Closes `db` and drops the database. */
  drop(): Promise<void>
}

/**
 * Makes an empty database with a random name on the server `EXPLORER_TEST_DATABASE_URL` names.
 *
 * @throws {Error} When the variable is unset: a database test fails without a server.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const serverUrl = process.env['EXPLORER_TEST_DATABASE_URL']
  if (serverUrl === undefined || serverUrl === '') {
    throw new Error(
      'EXPLORER_TEST_DATABASE_URL is unset: the database tests need a PostgreSQL 17 server',
    )
  }
  const name = `explorer_test_${randomBytes(8).toString('hex')}`
  const server = openDatabase(serverUrl)
  try {
    await sql`CREATE DATABASE ${sql.id(name)}`.execute(server)
  } catch (error) {
    await server.destroy()
    throw error
  }
  const databaseUrl = new URL(serverUrl)
  databaseUrl.pathname = `/${name}`
  const db = openDatabase(databaseUrl.href)
  return {
    db,
    url: databaseUrl.href,
    async drop(): Promise<void> {
      try {
        await db.destroy()
        await sql`DROP DATABASE ${sql.id(name)} WITH (FORCE)`.execute(server)
      } finally {
        await server.destroy()
      }
    },
  }
}

/**
 * Stores `events` with one transaction per transaction hash, inspected as `inspections` says by
 * hash, and the request rows those events add up to.
 */
export async function seedNetworkEvents(
  db: ExplorerDatabase,
  network: MidnightNetwork,
  events: readonly SignetContractEvent[],
  inspections: ReadonlyMap<string, StoredInspection>,
): Promise<void> {
  const table = (name: string): RawBuilder<unknown> => sql.id(networkSchemaName(network), name)
  const seen = new Set<string>()
  for (const event of events) {
    const { source } = event
    if (!seen.has(source.transactionHash)) {
      seen.add(source.transactionHash)
      const inspection = inspections.get(source.transactionHash)
      await sql`
        INSERT INTO ${table('transactions')}
          (hash, block_height, block_hash, block_time, inspection)
        VALUES (
          decode(${source.transactionHash}, 'hex'),
          ${source.blockHeight},
          decode(${source.blockHash}, 'hex'),
          ${source.blockTimestamp},
          ${inspection === undefined ? null : JSON.stringify(inspection)}::jsonb
        )
      `.execute(db)
    }
    await sql`
      INSERT INTO ${table('events')}
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
    `.execute(db)
  }
  await sql`
    INSERT INTO ${table('requests')} (
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
    FROM ${table('events')} e
    JOIN ${table('transactions')} t ON t.hash = e.transaction_hash
    WHERE e.request_id IS NOT NULL
    GROUP BY e.request_id
  `.execute(db)
  for (const event of events) {
    if (event.kind === 'decoded' && event.name === SignetEventName.SignBidirectionalEvent) {
      await networkDb(db, network)
        .insertInto('request_callers')
        .values({ request_id: event.requestId, caller: event.record.callerAddress })
        .onConflict((conflict) => conflict.doNothing())
        .execute()
    }
  }
}

/**
 * The stored inspection of each inspected transaction of `seedNetwork`, by transaction hash. Each
 * seeded event has a transaction of its own.
 */
export function storedInspectionsOfSeed(
  seedNetwork: ExplorerSeedNetwork,
): Map<string, StoredInspection> {
  const inspections = new Map<string, StoredInspection>()
  for (const { source } of seedNetwork.events) {
    const inspection = seedNetwork.inspections.get(source.id)
    if (inspection !== undefined) {
      inspections.set(
        source.transactionHash,
        'failed' in inspection
          ? inspection
          : {
              callChains: inspection.callChains,
              requests: { [String(source.id)]: { cell: inspection.requestCell } },
            },
      )
    }
  }
  return inspections
}
