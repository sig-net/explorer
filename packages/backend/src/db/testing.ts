import { randomBytes } from 'node:crypto'

import { sql } from 'kysely'

import { type ExplorerDatabase, openDatabase } from './database.ts'

export interface TestDatabase {
  readonly db: ExplorerDatabase
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
