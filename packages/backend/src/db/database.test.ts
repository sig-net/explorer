import { sql } from 'kysely'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { type ExplorerDatabase, openDatabase } from './database.ts'
import { createTestDatabase, type TestDatabase } from './testing.ts'

const TEST_TIMEOUT_MS = 60_000

let database: TestDatabase

beforeAll(async () => {
  database = await createTestDatabase()
})

afterAll(async () => {
  await database.drop()
})

interface ObservedDatabase {
  readonly db: ExplorerDatabase
  /** What the listener of `db` has received. */
  readonly errors: Error[]
  /** Has the server end every connection of `db`, and returns how many it ended. */
  endConnections(): Promise<number>
}

/** A pool of its own on the test database, told apart on the server by `applicationName`. */
function openObservedDatabase(applicationName: string): ObservedDatabase {
  const url = new URL(database.url)
  url.searchParams.set('application_name', applicationName)
  const errors: Error[] = []
  const db = openDatabase(url.href, (error) => {
    errors.push(error)
  })
  return {
    db,
    errors,
    async endConnections(): Promise<number> {
      const { rows } = await sql`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE application_name = ${applicationName}
      `.execute(database.db)
      return rows.length
    },
  }
}

async function one(db: ExplorerDatabase): Promise<number | undefined> {
  const { rows } = await sql<{ one: number }>`SELECT 1 AS one`.execute(db)
  return rows[0]?.one
}

describe('openDatabase', () => {
  it(
    'a connection the server ends does not end the process',
    async () => {
      const observed = openObservedDatabase('explorer_idle_connection')
      try {
        expect(await one(observed.db)).toBe(1)

        expect(await observed.endConnections()).toBe(1)

        await vi.waitFor(() => {
          expect(observed.errors).toHaveLength(1)
        })
        expect(observed.errors[0]?.message).toBe(
          'terminating connection due to administrator command',
        )
        expect(await one(observed.db)).toBe(1)
      } finally {
        await observed.db.destroy()
      }
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'a connection the server ends during a query fails the query and does not end the process',
    async () => {
      const observed = openObservedDatabase('explorer_connection_in_use')
      try {
        const sleeping = sql`SELECT pg_sleep(30)`.execute(observed.db)
        // The query fails while the termination is awaited, before the assertion below listens.
        sleeping.catch(() => {})
        await vi.waitFor(async () => {
          expect(await observed.endConnections()).toBe(1)
        })

        await expect(sleeping).rejects.toThrow(
          'terminating connection due to administrator command',
        )
        await vi.waitFor(() => {
          expect(observed.errors).toHaveLength(1)
        })
        expect(observed.errors[0]?.message).toBe('Connection terminated unexpectedly')
        expect(await one(observed.db)).toBe(1)
      } finally {
        await observed.db.destroy()
      }
    },
    TEST_TIMEOUT_MS,
  )
})
