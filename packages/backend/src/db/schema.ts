import type {
  ContractCallNode,
  ExplorerSyncState,
  LifecycleWire,
  RequestCellWire,
} from '@sig-net/explorer-api'
import type { SignetContractRole } from '@sig-net/explorer-lib'
import type { MidnightNetwork } from '@sig-net/midnight'
import type { ColumnType, Generated, JSONColumnType, Kysely } from 'kysely'

import type { ExplorerDatabase } from './database.ts'

/** The tables and the view of one network's schema, as the migrations make them. */
export type NetworkTables = {
  ingest_state: IngestStateTable
  transactions: TransactionsTable
  events: EventsTable
  requests: RequestsTable
  request_callers: RequestCallersTable
  lifecycle: LifecycleView
}

export type NetworkDatabase = Kysely<NetworkTables>

/** `db` bound to the schema of `network`: every table name in a query resolves inside it. */
export function networkDb(db: ExplorerDatabase, network: MidnightNetwork): NetworkDatabase {
  return db.withSchema(networkSchemaName(network)).$extendTables<NetworkTables>()
}

export function networkSchemaName(network: MidnightNetwork): string {
  return `midnight_${network}`
}

/** One row at most. The three cursor columns are null together, until a block is processed. */
export interface IngestStateTable {
  singleton: Generated<true>
  genesis_hash: Buffer
  signer_address: Buffer
  responder_address: Buffer
  start_block: number
  cursor_height: number | null
  cursor_hash: Buffer | null
  cursor_block_time: Timestamp | null
  tip_height: number | null
  state: ExplorerSyncState
  last_success_at: Timestamp | null
  last_error: string | null
}

export interface TransactionsTable {
  hash: Buffer
  block_height: number
  block_hash: Buffer
  block_time: Timestamp
  raw: Buffer | null
  /** Null for a transaction that was not inspected. */
  inspection: JSONColumnType<StoredInspection> | null
}

/**
 * What the inspection of one transaction found: its call chains and, under the id of each sign
 * bidirectional event it emitted, the request cell that notification wrote, or the reason the
 * inspection failed.
 */
export type StoredInspection =
  | {
      readonly callChains: readonly ContractCallNode[]
      readonly requestCells: Readonly<Record<string, RequestCellWire | null>>
    }
  | { readonly failed: string }

export interface EventsTable {
  /** The indexer's event id. */
  id: number
  transaction_hash: Buffer
  contract_roles: SignetContractRole[]
  name: string
  payload: Buffer
  /** Lower case hex. Null when the event did not decode. */
  request_id: string | null
  /** Null when the event decoded, or when its name is not a Signet event name. */
  decode_failure: string | null
}

export interface RequestsTable {
  /** Lower case hex. */
  request_id: string
  first_event_id: number
  first_requested_at: Timestamp | null
  first_signature_at: Timestamp | null
  first_response_at: Timestamp | null
  sign_bidirectional_count: Generated<number>
  signature_responded_count: Generated<number>
  respond_bidirectional_count: Generated<number>
}

/** One row for each caller contract address a notification of the request names. */
export interface RequestCallersTable {
  /** Lower case hex. */
  request_id: string
  /** Lower case hex. */
  caller: string
}

/** A `requests` row with its events in the wire's shape, in emission order. */
export interface LifecycleView {
  request_id: ColumnType<string, never, never>
  first_event_id: ColumnType<number, never, never>
  first_requested_at: ColumnType<Date | null, never, never>
  first_signature_at: ColumnType<Date | null, never, never>
  first_response_at: ColumnType<Date | null, never, never>
  sign_bidirectional_count: ColumnType<number, never, never>
  signature_responded_count: ColumnType<number, never, never>
  respond_bidirectional_count: ColumnType<number, never, never>
  events: ColumnType<LifecycleWire['events'], never, never>
}

type Timestamp = ColumnType<Date, Date, Date>
