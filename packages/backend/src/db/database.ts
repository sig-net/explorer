import { Kysely, PostgresDialect } from 'kysely'
import { Pool, TypeOverrides, types } from 'pg'

/** The database before a network is chosen: reach a network's tables through `networkDb`. */
export type ExplorerDatabase = Kysely<NoTables>

export type NoTables = Record<never, never>

/**
 * Opens a pool on `connectionString`. A `bigint` column is read as a number, and a value past
 * 2^53 fails the query that read it.
 */
export function openDatabase(connectionString: string): ExplorerDatabase {
  const typeOverrides = new TypeOverrides()
  typeOverrides.setTypeParser(types.builtins.INT8, parseSafeInteger)
  return new Kysely<NoTables>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString, types: typeOverrides }) }),
  })
}

function parseSafeInteger(text: string): number {
  const value = Number(text)
  if (!Number.isSafeInteger(value)) {
    throw new Error(`the database holds ${text}, which a number cannot represent`)
  }
  return value
}
