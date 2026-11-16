import {
  ExplorerApiError,
  type ExplorerNetwork,
  type ExplorerNetworkSync,
  type ExplorerService,
  type InspectedSignBidirectionalLifecycle,
  type LifecyclePage,
  type LifecyclesQuery,
  lifecycleFromWire,
  lifecycleWireSchema,
  type ResolvedLifecyclesQuery,
  resolveLifecyclesQuery,
  urlWithoutCredentials,
} from '@sig-net/explorer-api'
import type { MidnightNetwork, RequestIdHex } from '@sig-net/midnight'
import type { Expression, ExpressionBuilder, Selectable, SqlBool, Transaction } from 'kysely'

import type { ExplorerDatabase } from '../db/database.ts'
import {
  type LifecycleView,
  type NetworkDatabase,
  networkDb,
  type NetworkTables,
} from '../db/schema.ts'

/**
 * An {@link ExplorerService} that answers from the network schemas of `db`, which the caller has
 * migrated for every network of `networks`.
 */
export function createPostgresExplorerService(
  db: ExplorerDatabase,
  networks: readonly ServedExplorerNetwork[],
): ExplorerService {
  const served = (network: MidnightNetwork): NetworkDatabase => {
    if (!networks.some((servedNetwork) => servedNetwork.network === network)) {
      throw new ExplorerApiError('unknown_network', `the explorer does not serve ${network}`)
    }
    return networkDb(db, network)
  }
  return {
    async networks(): Promise<ExplorerNetwork[]> {
      return Promise.all(
        networks.map(async ({ network, config }) => ({
          network,
          config: { ...config, sourceUrl: urlWithoutCredentials(config.sourceUrl) },
          sync: await readSync(networkDb(db, network)),
        })),
      )
    },
    async lifecycles(network: MidnightNetwork, query?: LifecyclesQuery): Promise<LifecyclePage> {
      const networkDatabase = served(network)
      const resolved = resolveLifecyclesQuery(query)
      return networkDatabase
        .transaction()
        .setIsolationLevel('repeatable read')
        .setAccessMode('read only')
        .execute((transaction) => readLifecyclePage(transaction, resolved))
    },
    async lifecycle(
      network: MidnightNetwork,
      requestId: RequestIdHex,
    ): Promise<InspectedSignBidirectionalLifecycle | null> {
      const row = await served(network)
        .selectFrom('lifecycle')
        .selectAll()
        .where('request_id', '=', requestId)
        .executeTakeFirst()
      return row === undefined ? null : lifecycleOfRow(row)
    },
    async callers(network: MidnightNetwork): Promise<string[]> {
      const rows = await served(network)
        .selectFrom('request_callers')
        .select('caller')
        .groupBy('caller')
        .orderBy('caller', (order) => order.collate('C'))
        .execute()
      return rows.map((row) => row.caller)
    },
  }
}

/** A network the explorer serves, as configured: its sync state is read from the store. */
export type ServedExplorerNetwork = Pick<ExplorerNetwork, 'network' | 'config'>

async function readSync(db: NetworkDatabase): Promise<ExplorerNetworkSync> {
  const row = await db
    .selectFrom('ingest_state')
    .select([
      'state',
      'cursor_height',
      'cursor_block_time',
      'tip_height',
      'last_success_at',
      'last_error',
    ])
    .executeTakeFirst()
  if (row === undefined) {
    return {
      state: 'starting',
      processedBlock: null,
      processedBlockTime: null,
      tipBlock: null,
      lastSuccessAt: null,
      error: null,
    }
  }
  return {
    state: row.state,
    processedBlock: row.cursor_height,
    processedBlockTime: row.cursor_block_time,
    tipBlock: row.tip_height,
    lastSuccessAt: row.last_success_at,
    error: row.last_error,
  }
}

async function readLifecyclePage(
  transaction: Transaction<NetworkTables>,
  query: ResolvedLifecyclesQuery,
): Promise<LifecyclePage> {
  const { before, limit } = query
  const matchingRequests = transaction
    .selectFrom('requests')
    .select(['request_id', 'first_event_id'])
    .where((eb) => matching(eb, query))
  const pageRows = await (
    before === null ? matchingRequests : matchingRequests.where('first_event_id', '<', before)
  )
    .orderBy('first_event_id', 'desc')
    .limit(limit + 1)
    .execute()
  const page = pageRows.slice(0, limit)
  const viewRows =
    page.length === 0
      ? []
      : await transaction
          .selectFrom('lifecycle')
          .selectAll()
          .where(
            'request_id',
            'in',
            page.map((row) => row.request_id),
          )
          .orderBy('first_event_id', 'desc')
          .execute()
  if (viewRows.length !== page.length) {
    throw new Error('the lifecycle view lost a request the page chose')
  }
  const totals = await countRequests(transaction, { fragment: '', excludeCallers: [] })
  const matchingCounts =
    query.fragment === '' && query.excludeCallers.length === 0
      ? totals
      : await countRequests(transaction, query)
  const { totalEvents } = await transaction
    .selectFrom('events')
    .select((eb) => eb.fn.countAll<number>().as('totalEvents'))
    .executeTakeFirstOrThrow()
  return {
    lifecycles: viewRows.map(lifecycleOfRow),
    nextBefore: pageRows.length > limit ? (page.at(-1)?.first_event_id ?? null) : null,
    matchingRequests: matchingCounts.requests,
    matchingEvents: matchingCounts.events,
    totalRequests: totals.requests,
    totalEvents,
  }
}

type RequestsFilter = Pick<ResolvedLifecyclesQuery, 'fragment' | 'excludeCallers'>

/** The requests that match `filter` and the events they group, by the count columns. */
async function countRequests(
  transaction: Transaction<NetworkTables>,
  filter: RequestsFilter,
): Promise<{ readonly requests: number; readonly events: number }> {
  return transaction
    .selectFrom('requests')
    .select((eb) => [
      eb.fn.countAll<number>().as('requests'),
      eb.fn
        .coalesce(
          eb.fn.sum<number>(
            eb(
              eb('sign_bidirectional_count', '+', eb.ref('signature_responded_count')),
              '+',
              eb.ref('respond_bidirectional_count'),
            ),
          ),
          eb.lit(0),
        )
        .as('events'),
    ])
    .where((eb) => matching(eb, filter))
    .executeTakeFirstOrThrow()
}

/**
 * The search is a UNION of two index scans, which lets each half use its trigram index, and the
 * exclusion keeps a request that names no caller.
 */
function matching(
  eb: ExpressionBuilder<NetworkTables, 'requests'>,
  filter: RequestsFilter,
): Expression<SqlBool> {
  const conditions: Expression<SqlBool>[] = []
  if (filter.fragment !== '') {
    const pattern = `%${filter.fragment.replace(/[\\%_]/g, '\\$&')}%`
    conditions.push(
      eb(
        'requests.request_id',
        'in',
        eb
          .selectFrom('requests as searched')
          .select('searched.request_id')
          .where('searched.request_id', 'like', pattern)
          .union(
            eb
              .selectFrom('request_callers')
              .select('request_callers.request_id')
              .where('request_callers.caller', 'like', pattern),
          ),
      ),
    )
  }
  if (filter.excludeCallers.length > 0) {
    conditions.push(
      eb.not(
        eb.exists(
          eb
            .selectFrom('request_callers')
            .select('request_callers.caller')
            .whereRef('request_callers.request_id', '=', 'requests.request_id')
            .where('request_callers.caller', 'in', filter.excludeCallers),
        ),
      ),
    )
  }
  return eb.and(conditions)
}

function lifecycleOfRow(row: Selectable<LifecycleView>): InspectedSignBidirectionalLifecycle {
  const wire = lifecycleWireSchema.parse({
    requestId: row.request_id,
    firstEventId: row.first_event_id,
    events: row.events,
  })
  try {
    return lifecycleFromWire(wire)
  } catch (error) {
    // invalid_response is the client's code: a store that holds no lifecycle is the server's fault.
    throw new Error(`the store holds no lifecycle of request ${row.request_id}`, { cause: error })
  }
}
