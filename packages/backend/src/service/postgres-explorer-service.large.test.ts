import { explorerSeed } from '@sig-net/explorer-api/testing'
import { MidnightNetwork } from '@sig-net/midnight'
import {
  CompiledQuery,
  createQueryId,
  type KyselyPlugin,
  type RootOperationNode,
  sql,
  type RawBuilder,
} from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { migrateNetworkSchema } from '../db/migrate.ts'
import { networkSchemaName } from '../db/schema.ts'
import { createTestDatabase, type TestDatabase } from '../db/testing.ts'
import { createPostgresExplorerService } from './postgres-explorer-service.ts'

const PREPROD = MidnightNetwork.Preprod
const REQUESTS = 200_000
const DISTINCT_CALLERS = 2_000
const TIME_LIMIT_MS = 500

const servedNetworks = explorerSeed.networks
  .filter(({ network }) => network === PREPROD)
  .map(({ network, config }) => ({ network, config }))

let database: TestDatabase

function table(name: string): RawBuilder<unknown> {
  return sql.id(networkSchemaName(PREPROD), name)
}

/**
 * Request n is notified by caller n % 2,000 in event 2n - 1, and every even request is signed in
 * event 2n. Every tenth request is only signed, so it names no caller.
 */
beforeAll(async () => {
  database = await createTestDatabase()
  await migrateNetworkSchema(database.db, PREPROD)
  await sql`
    CREATE TEMPORARY TABLE seeded AS
    SELECT
      n,
      md5('request ' || n) || md5('request id ' || n) AS request_id,
      md5('caller ' || n % ${DISTINCT_CALLERS}) || md5('address ' || n % ${DISTINCT_CALLERS})
        AS caller,
      n % 10 <> 0 AS notified,
      n % 2 = 0 AS signed
    FROM generate_series(1, ${REQUESTS}) AS n
  `.execute(database.db)
  await sql`
    CREATE TEMPORARY TABLE seeded_events AS
    SELECT
      2 * n - 1 AS id, request_id, 'SignBidirectionalEvent' AS name, ARRAY['signer'] AS roles,
      '\\x01'::bytea || decode(request_id, 'hex') || decode(caller, 'hex')
        || '\\x0104000000'::bytea || decode(repeat('00', 186), 'hex') AS payload
    FROM seeded WHERE notified
    UNION ALL
    SELECT
      2 * n, request_id, 'SignatureRespondedEvent', ARRAY['responder'],
      decode(request_id, 'hex') || decode(repeat('33', 96) || '01', 'hex')
        || decode(repeat('00', 127), 'hex')
    FROM seeded WHERE signed
  `.execute(database.db)
  await sql`
    INSERT INTO ${table('transactions')} (hash, block_height, block_hash, block_time)
    SELECT
      decode(md5('transaction ' || id) || md5('hash ' || id), 'hex'),
      id,
      decode(md5('block ' || id) || md5('block hash ' || id), 'hex'),
      timestamptz '2026-09-07T12:00:00Z' + id * interval '6 seconds'
    FROM seeded_events
  `.execute(database.db)
  await sql`
    INSERT INTO ${table('events')}
      (id, transaction_hash, contract_roles, name, payload, request_id)
    SELECT id, decode(md5('transaction ' || id) || md5('hash ' || id), 'hex'), roles, name,
      payload, request_id
    FROM seeded_events
  `.execute(database.db)
  await sql`
    INSERT INTO ${table('requests')} (
      request_id, first_event_id, first_requested_at, first_signature_at,
      sign_bidirectional_count, signature_responded_count
    )
    SELECT
      request_id,
      CASE WHEN notified THEN 2 * n - 1 ELSE 2 * n END,
      CASE WHEN notified THEN timestamptz '2026-09-07T12:00:00Z' + (2 * n - 1) * interval '6 seconds' END,
      CASE WHEN signed THEN timestamptz '2026-09-07T12:00:00Z' + 2 * n * interval '6 seconds' END,
      CASE WHEN notified THEN 1 ELSE 0 END,
      CASE WHEN signed THEN 1 ELSE 0 END
    FROM seeded
  `.execute(database.db)
  await sql`
    INSERT INTO ${table('request_callers')} (request_id, caller)
    SELECT request_id, caller FROM seeded WHERE notified
  `.execute(database.db)
  await sql`VACUUM (ANALYZE)`.execute(database.db)
}, 600_000)

afterAll(async () => {
  await database.drop()
})

/** Calls `call` twice and gives the second call's answer and duration. */
async function timed<T>(
  title: string,
  call: () => Promise<T>,
): Promise<{ readonly answer: T; readonly ms: number }> {
  await call()
  const start = performance.now()
  const answer = await call()
  const ms = performance.now() - start
  console.info(`${title}: ${ms.toFixed(1)} ms`)
  return { answer, ms }
}

/** The request id and caller of request `n` of the seed. */
async function seededRequest(n: number): Promise<{ requestId: string; caller: string }> {
  const { rows } = await sql<{ requestId: string; caller: string }>`
    SELECT
      md5('request ' || ${n}::int) || md5('request id ' || ${n}::int) AS "requestId",
      md5('caller ' || ${n}::int % ${DISTINCT_CALLERS})
        || md5('address ' || ${n}::int % ${DISTINCT_CALLERS}) AS caller
  `.execute(database.db)
  const [row] = rows
  if (row === undefined) {
    throw new Error(`request ${String(n)} has no seeded row`)
  }
  return row
}

describe('the query service over 200,000 requests', () => {
  it('the newest page of 200,000 requests answers within 500 ms', async () => {
    const service = createPostgresExplorerService(database.db, servedNetworks)

    const { answer, ms } = await timed('newest page', () => service.lifecycles(PREPROD))

    expect(answer.lifecycles).toHaveLength(50)
    expect(answer.lifecycles[0]?.firstEventId).toBe(2 * REQUESTS)
    expect(answer.totalRequests).toBe(REQUESTS)
    expect(answer.matchingRequests).toBe(REQUESTS)
    expect(ms).toBeLessThan(TIME_LIMIT_MS)
  })

  it('a search of 200,000 requests by a fragment of a request id answers within 500 ms', async () => {
    const service = createPostgresExplorerService(database.db, servedNetworks)
    const { requestId } = await seededRequest(123_457)

    const { answer, ms } = await timed('request id search', () =>
      service.lifecycles(PREPROD, { search: requestId.slice(7, 19) }),
    )

    expect(answer.lifecycles.map((lifecycle) => lifecycle.requestId)).toContain(requestId)
    expect(answer.matchingRequests).toBeLessThan(5)
    expect(ms).toBeLessThan(TIME_LIMIT_MS)
  })

  it('a search of 200,000 requests by a fragment of a caller answers within 500 ms', async () => {
    const service = createPostgresExplorerService(database.db, servedNetworks)
    const { caller } = await seededRequest(1_234)

    const { answer, ms } = await timed('caller search', () =>
      service.lifecycles(PREPROD, { search: caller.slice(40, 52) }),
    )

    // Request 1,234 shares its caller with every 2,000th request from it.
    expect(answer.matchingRequests).toBe(REQUESTS / DISTINCT_CALLERS)
    expect(answer.lifecycles).toHaveLength(50)
    expect(ms).toBeLessThan(TIME_LIMIT_MS)
  })

  it('excluding a caller of 200,000 requests answers within 500 ms', async () => {
    const service = createPostgresExplorerService(database.db, servedNetworks)
    const { caller } = await seededRequest(1_234)

    const { answer, ms } = await timed('caller exclusion', () =>
      service.lifecycles(PREPROD, { excludeCallers: [caller] }),
    )

    expect(answer.matchingRequests).toBe(REQUESTS - REQUESTS / DISTINCT_CALLERS)
    expect(answer.lifecycles).toHaveLength(50)
    expect(ms).toBeLessThan(TIME_LIMIT_MS)
  })

  it('the callers of 200,000 requests answer within 500 ms', async () => {
    const service = createPostgresExplorerService(database.db, servedNetworks)

    const { answer, ms } = await timed('callers', () => service.callers(PREPROD))

    // A caller whose number is a multiple of 10 notifies nothing.
    expect(answer).toHaveLength((DISTINCT_CALLERS * 9) / 10)
    expect(answer).toEqual(answer.toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
    expect(ms).toBeLessThan(TIME_LIMIT_MS)
  })

  it('a selective search reads neither requests nor request_callers in full', async () => {
    const statements: RootOperationNode[] = []
    const capture: KyselyPlugin = {
      transformQuery({ node }) {
        statements.push(node)
        return node
      },
      async transformResult({ result }) {
        return result
      },
    }
    const service = createPostgresExplorerService(database.db.withPlugin(capture), servedNetworks)
    const { requestId, caller } = await seededRequest(98_765)

    for (const search of [requestId.slice(3, 15), caller.slice(17, 29)]) {
      statements.length = 0
      await service.lifecycles(PREPROD, { search })
      const executor = database.db.getExecutor()
      const searched = statements
        .map((node) => executor.compileQuery(node, createQueryId()))
        .filter((compiled) => compiled.sql.includes(' like '))
      const plans = await Promise.all(
        searched.map(async (compiled) => {
          const { rows } = await database.db.executeQuery<{ 'QUERY PLAN': string }>(
            CompiledQuery.raw(`EXPLAIN ${compiled.sql}`, [...compiled.parameters]),
          )
          return rows.map((row) => row['QUERY PLAN']).join('\n')
        }),
      )

      // The page and the matching counts.
      expect(plans).toHaveLength(2)
      for (const plan of plans) {
        expect(plan).toContain('Bitmap Index Scan on requests_request_id_trgm')
        expect(plan).toContain('Bitmap Index Scan on request_callers_caller_trgm')
        expect(plan).not.toContain('Seq Scan')
      }
    }
  })
})
