import { MIDNIGHT_NETWORKS } from '@sig-net/explorer-lib'
import { notificationEvent } from '@sig-net/explorer-lib/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { ExplorerDatabase } from '../db/database.ts'
import { migrateNetworkSchema, wipeNetworkSchema } from '../db/migrate.ts'
import { networkDb } from '../db/schema.ts'
import { createTestDatabase, type TestDatabase } from '../db/testing.ts'
import { createInMemoryMidnightSource } from '../source/in-memory.ts'
import type { MidnightSource } from '../source/port.ts'
import type {
  IngestCycleDependencies,
  IngestCycleOutcome,
  IngestCycleSettings,
} from './ingest-cycle.ts'
import { type IngestLoopSleep, startIngestLoop } from './ingest-loop.ts'
import {
  at,
  blockHash,
  blockOf,
  blockTime,
  chainOf,
  FIRST_BLOCK,
  GENESIS_HASH,
  inspectedWithoutCells,
  type PlacedEvent,
  SETTINGS,
} from './testing.ts'

const NETWORK = SETTINGS.network
const POLL_INTERVAL_MS = 50_000
const OTHER_GENESIS_HASH = '77'.repeat(32)
const REQUEST = new Uint8Array(32).fill(0xa1)
const CALLER = new Uint8Array(32).fill(0xc1)

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
  await migrateNetworkSchema(database.db, NETWORK)
})

/** What happens while the loop sleeps for the n-th time, counted from 1. */
type DuringSleep = (sleeps: number) => void | Promise<void>

interface LoopRun {
  readonly outcomes: IngestCycleOutcome[]
  /** The length of each sleep the loop asked for. */
  readonly waits: number[]
}

/**
 * Runs the loop until it has slept `sleeps` times: the last sleep aborts it. No sleep waits on a
 * clock.
 */
async function runLoop(
  deps: IngestCycleDependencies,
  sleeps: number,
  duringSleep: DuringSleep = () => {},
  settings: Partial<IngestCycleSettings> = {},
  onOutcome: (outcome: IngestCycleOutcome) => void = () => {},
): Promise<LoopRun> {
  const controller = new AbortController()
  const outcomes: IngestCycleOutcome[] = []
  const waits: number[] = []
  const sleep: IngestLoopSleep = async (ms) => {
    waits.push(ms)
    if (waits.length === sleeps) {
      controller.abort()
      return
    }
    await duringSleep(waits.length)
  }
  await startIngestLoop(
    deps,
    { ...SETTINGS, ...settings },
    {
      pollIntervalMs: POLL_INTERVAL_MS,
      signal: controller.signal,
      onOutcome: (outcome) => {
        outcomes.push(outcome)
        onOutcome(outcome)
      },
      sleep,
    },
  )
  return { outcomes, waits }
}

function depsOf(source: MidnightSource): IngestCycleDependencies {
  return { db: database.db, source, inspect: inspectedWithoutCells }
}

function kindsOf(outcomes: readonly IngestCycleOutcome[]): IngestCycleOutcome['kind'][] {
  return outcomes.map((outcome) => outcome.kind)
}

/** A source that reads `initial` until `use` names another. */
function switchable(initial: MidnightSource): {
  readonly source: MidnightSource
  use(next: MidnightSource): void
} {
  let current = initial
  return {
    use(next: MidnightSource): void {
      current = next
    },
    source: {
      genesisHash: () => current.genesisHash(),
      finalisedTip: () => current.finalisedTip(),
      blockAt: (height) => current.blockAt(height),
      eventsIn: (range) => current.eventsIn(range),
      rawTransaction: (hash) => current.rawTransaction(hash),
    },
  }
}

/** `source` whose tip cannot be read while `down` is true. */
function withOutages(source: MidnightSource): {
  readonly source: MidnightSource
  down: boolean
} {
  const outages = {
    down: false,
    source: {
      ...source,
      finalisedTip: () =>
        outages.down ? Promise.reject(new Error('the source is down')) : source.finalisedTip(),
    },
  }
  return outages
}

/** `source` whose tip is answered only after `release`. */
function heldTip(source: MidnightSource): {
  readonly source: MidnightSource
  /** Resolves when the tip is first asked for. */
  readonly asked: Promise<void>
  release(): void
} {
  let release = (): void => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let held: MidnightSource = source
  const asked = new Promise<void>((resolve) => {
    held = {
      ...source,
      finalisedTip: async () => {
        resolve()
        await released
        return source.finalisedTip()
      },
    }
  })
  return { asked, release, source: held }
}

function chainWithGenesis(
  genesisHash: string,
  toHeight: number,
  placed: readonly PlacedEvent[],
): MidnightSource {
  return createInMemoryMidnightSource(
    genesisHash,
    Array.from({ length: toHeight - FIRST_BLOCK + 1 }, (_, index) =>
      blockOf(FIRST_BLOCK + index, placed),
    ),
  )
}

async function stateOf() {
  return networkDb(database.db, NETWORK)
    .selectFrom('ingest_state')
    .selectAll()
    .executeTakeFirstOrThrow()
}

async function eventIds(): Promise<number[]> {
  const events = await networkDb(database.db, NETWORK)
    .selectFrom('events')
    .select('id')
    .orderBy('id')
    .execute()
  return events.map((event) => event.id)
}

describe('the ingest loop', () => {
  it('cycles at once while there is more to read and waits once caught up', async () => {
    const source = chainOf(1010, [at(1002, notificationEvent(1, REQUEST, CALLER, 0))])

    const { outcomes, waits } = await runLoop(
      depsOf(source),
      2,
      () => {
        source.appendBlock(blockOf(1011, []))
        source.appendBlock(blockOf(1012, []))
      },
      { maxRange: 3 },
    )

    expect(outcomes).toEqual([
      { kind: 'stored', fromBlock: 1001, toBlock: 1003, events: 1 },
      { kind: 'stored', fromBlock: 1004, toBlock: 1006, events: 0 },
      { kind: 'stored', fromBlock: 1007, toBlock: 1008, events: 0 },
      { kind: 'caught-up' },
      { kind: 'stored', fromBlock: 1009, toBlock: 1010, events: 0 },
      { kind: 'caught-up' },
    ])
    expect(waits).toEqual([POLL_INTERVAL_MS, POLL_INTERVAL_MS])
    expect(await stateOf()).toMatchObject({ cursor_height: 1010, state: 'synced' })
  })

  it('backs off after failures and resets on success', async () => {
    const outages = withOutages(chainOf(1004, []))
    outages.down = true

    const { outcomes, waits } = await runLoop(depsOf(outages.source), 6, (sleeps) => {
      outages.down = sleeps < 4 || sleeps === 5
    })

    expect(kindsOf(outcomes)).toEqual([
      'failed',
      'failed',
      'failed',
      'failed',
      'stored',
      'caught-up',
      'failed',
    ])
    expect(waits).toEqual([
      2 * POLL_INTERVAL_MS,
      4 * POLL_INTERVAL_MS,
      300_000,
      300_000,
      POLL_INTERVAL_MS,
      2 * POLL_INTERVAL_MS,
    ])
    expect(await stateOf()).toMatchObject({ cursor_height: 1002, last_error: 'the source is down' })
  })

  it('a cycle that rejects backs off and the loop goes on', async () => {
    let rejections = 2
    const deps: IngestCycleDependencies = {
      source: chainOf(1004, []),
      inspect: inspectedWithoutCells,
      get db(): ExplorerDatabase {
        if (rejections > 0) {
          rejections -= 1
          throw new Error('no connection to postgres://explorer:hunter2@db.example:5432/explorer')
        }
        return database.db
      },
    }

    const { outcomes, waits } = await runLoop(deps, 3)

    const error = 'no connection to postgres://db.example:5432/explorer'
    expect(outcomes).toEqual([
      { kind: 'failed', error },
      { kind: 'failed', error },
      { kind: 'stored', fromBlock: 1001, toBlock: 1002, events: 0 },
      { kind: 'caught-up' },
    ])
    expect(waits).toEqual([2 * POLL_INTERVAL_MS, 4 * POLL_INTERVAL_MS, POLL_INTERVAL_MS])
  })

  it('stops when the signal aborts', async () => {
    const chain = chainOf(1004, [])
    const deps = depsOf(chain)

    const aborted = new AbortController()
    aborted.abort()
    const beforeAnyCycle: IngestCycleOutcome[] = []
    await startIngestLoop(deps, SETTINGS, {
      pollIntervalMs: POLL_INTERVAL_MS,
      signal: aborted.signal,
      onOutcome: (outcome) => beforeAnyCycle.push(outcome),
    })
    expect(beforeAnyCycle).toEqual([])

    const sleeping = new AbortController()
    const whileSleeping: IngestCycleOutcome[] = []
    await startIngestLoop(deps, SETTINGS, {
      pollIntervalMs: 3_600_000,
      signal: sleeping.signal,
      onOutcome: (outcome) => {
        whileSleeping.push(outcome)
        if (outcome.kind === 'caught-up') {
          setImmediate(() => {
            sleeping.abort()
          })
        }
      },
    })
    expect(kindsOf(whileSleeping)).toEqual(['stored', 'caught-up'])

    const inFlight = new AbortController()
    const tip = heldTip(chain)
    const duringCycle: IngestCycleOutcome[] = []
    const waits: number[] = []
    let stopped = false
    const loop = startIngestLoop(depsOf(tip.source), SETTINGS, {
      pollIntervalMs: POLL_INTERVAL_MS,
      signal: inFlight.signal,
      onOutcome: (outcome) => duringCycle.push(outcome),
      sleep: (ms) => {
        waits.push(ms)
        return Promise.resolve()
      },
    }).then(() => {
      stopped = true
    })
    await tip.asked
    inFlight.abort()
    await new Promise((resolve) => setImmediate(resolve))
    expect(stopped).toBe(false)
    tip.release()
    await loop
    expect(duringCycle).toEqual([{ kind: 'caught-up' }])
    expect(waits).toEqual([])
  })

  it('a stopped network resumes after its schema is wiped and migrated', async () => {
    const chain = switchable(chainOf(1010, [at(1002, notificationEvent(1, REQUEST, CALLER, 0))]))
    const otherChain = chainWithGenesis(OTHER_GENESIS_HASH, 1010, [
      at(1003, notificationEvent(7, REQUEST, CALLER, 0)),
    ])

    const { outcomes, waits } = await runLoop(depsOf(chain.source), 5, async (sleeps) => {
      if (sleeps === 1) {
        chain.use(otherChain)
      } else if (sleeps === 3) {
        await wipeNetworkSchema(database.db, NETWORK)
      } else if (sleeps === 4) {
        await migrateNetworkSchema(database.db, NETWORK)
      }
    })

    const reason = `the source's genesis hash is ${OTHER_GENESIS_HASH} and the schema was indexed for ${GENESIS_HASH}`
    expect(outcomes).toEqual([
      { kind: 'stored', fromBlock: 1001, toBlock: 1008, events: 1 },
      { kind: 'caught-up' },
      { kind: 'stopped', reason },
      { kind: 'stopped', reason },
      { kind: 'failed', error: expect.stringContaining('ingest_state') },
      { kind: 'stored', fromBlock: 1001, toBlock: 1008, events: 1 },
      { kind: 'caught-up' },
    ])
    expect(waits).toEqual([
      POLL_INTERVAL_MS,
      POLL_INTERVAL_MS,
      POLL_INTERVAL_MS,
      2 * POLL_INTERVAL_MS,
      POLL_INTERVAL_MS,
    ])
    expect(await stateOf()).toMatchObject({
      genesis_hash: Buffer.from(OTHER_GENESIS_HASH, 'hex'),
      cursor_height: 1008,
      state: 'synced',
      last_error: null,
    })
    expect(await eventIds()).toEqual([7])
  })

  it('reports every outcome', async () => {
    const chain = chainOf(1010, [at(1002, notificationEvent(1, REQUEST, CALLER, 0))])
    let cursorMoved = false
    const source = switchable({
      ...chain,
      eventsIn: async (range) => {
        if (!cursorMoved) {
          cursorMoved = true
          await networkDb(database.db, NETWORK)
            .updateTable('ingest_state')
            .set({
              cursor_height: 1001,
              cursor_hash: Buffer.from(blockHash(1001), 'hex'),
              cursor_block_time: blockTime(1001),
            })
            .execute()
        }
        return chain.eventsIn(range)
      },
    })

    const { outcomes, waits } = await runLoop(
      depsOf(source.source),
      4,
      (sleeps) => {
        if (sleeps === 2) {
          chain.failNextCall(new Error('the indexer answered 502'))
        } else if (sleeps === 3) {
          source.use(chainWithGenesis(OTHER_GENESIS_HASH, 1010, []))
        }
      },
      {},
      () => {
        throw new Error('the reporter is broken')
      },
    )

    expect(outcomes).toEqual([
      { kind: 'superseded' },
      { kind: 'stored', fromBlock: 1002, toBlock: 1008, events: 1 },
      { kind: 'caught-up' },
      { kind: 'failed', error: 'the indexer answered 502' },
      {
        kind: 'stopped',
        reason: `the source's genesis hash is ${OTHER_GENESIS_HASH} and the schema was indexed for ${GENESIS_HASH}`,
      },
    ])
    expect(waits).toEqual([
      POLL_INTERVAL_MS,
      POLL_INTERVAL_MS,
      2 * POLL_INTERVAL_MS,
      POLL_INTERVAL_MS,
    ])
  })
})
