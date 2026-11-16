import { Kysely, PostgresDialect } from 'kysely'
import { Pool, TypeOverrides, types } from 'pg'

/** The database before a network is chosen: reach a network's tables through `networkDb`. */
export type ExplorerDatabase = Kysely<NoTables>

export type NoTables = Record<never, never>

/**
 * Opens a pool on `connectionString`. A `bigint` column is read as a number, and a value past
 * 2^53 fails the query that read it. `onConnectionError` receives the error of each connection
 * that ends without the pool closing it, idle or in use.
 */
export function openDatabase(
  connectionString: string,
  onConnectionError: (error: Error) => void,
): ExplorerDatabase {
  const typeOverrides = new TypeOverrides()
  typeOverrides.setTypeParser(types.builtins.INT8, parseSafeInteger)
  const pool = new Pool({ connectionString, types: typeOverrides })
  // An `error` event with no listener ends the process, and the pool listens on a client only while it is idle.
  pool.on('connect', (client) => {
    client.on('error', onConnectionError)
  })
  // The client's listener has reported what the pool repeats here.
  pool.on('error', () => {})
  return new Kysely<NoTables>({ dialect: new PostgresDialect({ pool }) })
}

function parseSafeInteger(text: string): number {
  const value = Number(text)
  if (!Number.isSafeInteger(value)) {
    throw new Error(`the database holds ${text}, which a number cannot represent`)
  }
  return value
}
