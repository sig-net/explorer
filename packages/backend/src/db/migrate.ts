import { readdir, readFile } from 'node:fs/promises'

import type { MidnightNetwork } from '@sig-net/midnight'
import { type Kysely, sql } from 'kysely'

import type { ExplorerDatabase, NoTables } from './database.ts'
import { networkSchemaName } from './schema.ts'

/**
 * Brings the schema of `network` up to the newest migration: makes the schema when it is missing,
 * then applies each migration it has not recorded, in name order, each in its own transaction.
 * Processes that call it together apply each migration once.
 */
export async function migrateNetworkSchema(
  db: ExplorerDatabase,
  network: MidnightNetwork,
): Promise<void> {
  const schema = networkSchemaName(network)
  const migrations = await readMigrations()
  await withAdvisoryLock(db, TRIGRAM_EXTENSION, async (connection) => {
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public`.execute(connection)
  })
  await withAdvisoryLock(db, schema, async (connection) => {
    await sql`CREATE SCHEMA IF NOT EXISTS ${sql.id(schema)}`.execute(connection)
    await sql`
      CREATE TABLE IF NOT EXISTS ${sql.id(schema, 'migrations')} (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `.execute(connection)
    const applied = await sql<{ name: string }>`
      SELECT name FROM ${sql.id(schema, 'migrations')}
    `.execute(connection)
    const appliedNames = new Set(applied.rows.map((row) => row.name))
    for (const migration of migrations) {
      if (appliedNames.has(migration.name)) {
        continue
      }
      await connection.transaction().execute(async (transaction) => {
        await sql`SET LOCAL search_path TO ${sql.id(schema)}, public`.execute(transaction)
        await sql.raw(migration.statements).execute(transaction)
        await sql`
          INSERT INTO ${sql.id(schema, 'migrations')} (name) VALUES (${migration.name})
        `.execute(transaction)
      })
    }
  })
}

/** Drops the schema of `network` with everything in it. */
export async function wipeNetworkSchema(
  db: ExplorerDatabase,
  network: MidnightNetwork,
): Promise<void> {
  const schema = networkSchemaName(network)
  await withAdvisoryLock(db, schema, async (connection) => {
    await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(connection)
  })
}

const MIGRATIONS_FOLDER = new URL('./migrations/', import.meta.url)

/** The advisory lock key under which the extension is created: no schema carries this name. */
const TRIGRAM_EXTENSION = 'extension pg_trgm'

interface Migration {
  readonly name: string
  readonly statements: string
}

async function readMigrations(): Promise<Migration[]> {
  const names = (await readdir(MIGRATIONS_FOLDER)).filter((name) => name.endsWith('.sql')).sort()
  if (names.length === 0) {
    throw new Error(`no migration is in ${MIGRATIONS_FOLDER.pathname}`)
  }
  return Promise.all(
    names.map(async (name) => ({
      name,
      statements: await readFile(new URL(name, MIGRATIONS_FOLDER), 'utf8'),
    })),
  )
}

/**
 * Runs `work` on one connection that holds the session advisory lock named `key`, so that two
 * callers with the same key run one after the other.
 */
async function withAdvisoryLock(
  db: ExplorerDatabase,
  key: string,
  work: (connection: Kysely<NoTables>) => Promise<void>,
): Promise<void> {
  await db.connection().execute(async (connection) => {
    await sql`SELECT pg_advisory_lock(hashtextextended(${key}, 0))`.execute(connection)
    try {
      await work(connection)
    } finally {
      await sql`SELECT pg_advisory_unlock(hashtextextended(${key}, 0))`.execute(connection)
    }
  })
}
