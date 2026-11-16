import { textWithoutUrlCredentials } from '@sig-net/explorer-api'
import { serve, type ServerType } from '@hono/node-server'
import { isMidnightNetwork } from '@sig-net/explorer-lib'
import type { MidnightNetwork } from '@sig-net/midnight'

import type { BackendConfig, BackendNetworkConfig } from './config/backend-env.ts'
import { type ExplorerDatabase, openDatabase } from './db/database.ts'
import { migrateNetworkSchema, wipeNetworkSchema } from './db/migrate.ts'
import { networkSchemaName } from './db/schema.ts'
import { createHttpApp } from './http/http-app.ts'
import type { IngestCycleOutcome, InspectTransaction } from './ingest/ingest-cycle.ts'
import { type IngestLoopSleep, startIngestLoop } from './ingest/ingest-loop.ts'
import { createPostgresExplorerService } from './service/postgres-explorer-service.ts'
import type { MidnightSource } from './source/port.ts'

/**
 * Serves the API on `config.host` and `config.port`, where port 0 lets the system choose, and
 * resolves once the server listens. The migrations and the ingest loops follow as `started`.
 *
 * @throws {Error} When the server cannot listen, after the failure is logged and the pool closed.
 */
export async function startBackend(
  config: BackendConfig,
  dependencies: BackendDependencies,
): Promise<RunningBackend> {
  const { createSource, inspect, sleep, migrate = migrateNetworkSchema } = dependencies
  const log = (entry: BackendLogEntry): void => {
    dependencies.log(entryWithoutUrlCredentials(entry))
  }
  const db = openDatabase(config.databaseUrl, (error) => {
    log({ level: 'error', message: 'a database connection ended', error: error.message })
  })
  const loopsEnd = new AbortController()
  const loops: Promise<void>[] = []
  let ready = false
  let stopped: Promise<void> | null = null

  const app = createHttpApp({
    service: createPostgresExplorerService(db, config.networks),
    corsOrigins: config.corsOrigins,
    ready: () => ready,
    logError: (message) => {
      log({ level: 'error', message })
    },
  })
  let server: ServerType
  let port: number
  try {
    ;({ server, port } = await listen(app.fetch, config.host, config.port))
  } catch (error) {
    log({ level: 'error', message: 'the server does not listen', error: errorText(error) })
    await db.destroy()
    throw error
  }
  log({ level: 'info', message: 'listening', host: config.host, port })

  const startLoop = (network: BackendNetworkConfig): void => {
    let kindBefore: IngestCycleOutcome['kind'] | null = null
    const onOutcome = (outcome: IngestCycleOutcome): void => {
      if (outcome.kind !== 'caught-up' || kindBefore !== 'caught-up') {
        log(outcomeEntry(network.network, outcome))
      }
      kindBefore = outcome.kind
    }
    try {
      loops.push(
        startIngestLoop(
          { db, source: createSource(network), inspect },
          {
            network: network.network,
            signerContractAddress: network.config.signerContractAddress,
            responderContractAddress: network.config.responderContractAddress,
            startBlock: network.config.startBlock,
            maxRange: network.maxRange,
            tipMargin: network.tipMargin,
          },
          {
            pollIntervalMs: network.pollIntervalSeconds * 1000,
            signal: loopsEnd.signal,
            onOutcome,
            ...(sleep === undefined ? {} : { sleep }),
          },
        ),
      )
    } catch (error) {
      log({
        level: 'error',
        message: 'the ingest loop did not start',
        network: network.network,
        error: errorText(error),
      })
    }
  }

  const stop = (): Promise<void> => {
    stopped ??= (async (): Promise<void> => {
      ready = false
      log({ level: 'info', message: 'shutting down' })
      // A request in flight is answered while the loops are awaited: only then is it cut.
      const closed = new Promise<void>((resolve) => {
        server.close(() => {
          resolve()
        })
      })
      loopsEnd.abort()
      const inFlight = Promise.allSettled([migrated, ...loops])
      const ended = await endsWithin(inFlight, LOOPS_STOP_TIMEOUT_MS)
      if ('closeAllConnections' in server) {
        server.closeAllConnections()
      }
      await closed
      if (ended) {
        await db.destroy()
      } else {
        log({ level: 'error', message: 'abandoned the work still in flight' })
        // The pool closes only once abandoned work gives its connection back.
        db.destroy().catch(() => {})
      }
      log({ level: 'info', message: 'shut down' })
    })()
    return stopped
  }

  const migrated = (async (): Promise<void> => {
    for (const { network } of config.networks) {
      if (stopped !== null) {
        return
      }
      log({ level: 'info', message: 'migrating', network })
      try {
        await migrate(db, network)
      } catch (error) {
        log({ level: 'error', message: 'the migration failed', network, error: errorText(error) })
        throw error
      }
      log({ level: 'info', message: 'migrated', network })
    }
  })()
  const started = migrated.then(
    () => {
      if (stopped === null) {
        ready = true
        config.networks.forEach(startLoop)
      }
    },
    async (error: unknown) => {
      await stop()
      throw error
    },
  )
  // The caller decides what a failed start means: this keeps a late handler from being a crash.
  started.catch(() => {})

  return { port, started, stop }
}

export interface BackendDependencies {
  readonly createSource: (network: BackendNetworkConfig) => MidnightSource
  readonly inspect: InspectTransaction
  /** Receives every entry with its texts cut of URL credentials. */
  readonly log: (entry: BackendLogEntry) => void
  /** The wait between ingest cycles. The default waits on a timer. */
  readonly sleep?: IngestLoopSleep
  readonly migrate?: (db: ExplorerDatabase, network: MidnightNetwork) => Promise<void>
}

export interface BackendLogEntry {
  readonly level: 'info' | 'error'
  readonly message: string
  readonly network?: MidnightNetwork
  readonly [field: string]: string | number | undefined
}

export interface RunningBackend {
  /** The port the server listens on. */
  readonly port: number
  /**
   * Resolves once every network is migrated and its ingest loop runs. Rejects with the error of a
   * migration that failed, after the backend has stopped.
   */
  readonly started: Promise<void>
  /**
   * Stops serving, ends the ingest loops and closes the pool. Work still in flight after
   * {@link LOOPS_STOP_TIMEOUT_MS} is abandoned.
   */
  stop(): Promise<void>
}

/**
 * Drops the schema of the configured network `networkArgument` names and migrates it again, so
 * that a running backend indexes the network from its start block.
 *
 * @param onConnectionError Receives the error of each connection the server ends meanwhile.
 * @returns The name of the schema.
 * @throws {Error} Before anything is opened, when `config` holds no such network.
 */
export async function wipeNetwork(
  config: BackendConfig,
  networkArgument: string,
  onConnectionError: (error: Error) => void,
): Promise<string> {
  const configured = isMidnightNetwork(networkArgument)
    ? config.networks.find(({ network }) => network === networkArgument)
    : undefined
  if (configured === undefined) {
    const networks = config.networks.map(({ network }) => network).join(', ')
    throw new Error(
      `${JSON.stringify(networkArgument)} is not a configured network: the configured networks are ${networks}`,
    )
  }
  const db = openDatabase(config.databaseUrl, onConnectionError)
  try {
    await wipeNetworkSchema(db, configured.network)
    await migrateNetworkSchema(db, configured.network)
  } finally {
    await db.destroy()
  }
  return networkSchemaName(configured.network)
}

/** Under a 30 s termination grace period, with room for the pool to close. */
export const LOOPS_STOP_TIMEOUT_MS = 8000

function listen(
  fetch: Parameters<typeof serve>[0]['fetch'],
  hostname: string,
  port: number,
): Promise<{ server: ServerType; port: number }> {
  return new Promise((resolve, reject) => {
    const server = serve({ fetch, hostname, port }, (address) => {
      server.off('error', reject)
      resolve({ server, port: address.port })
    })
    server.once('error', reject)
  })
}

function outcomeEntry(network: MidnightNetwork, outcome: IngestCycleOutcome): BackendLogEntry {
  switch (outcome.kind) {
    case 'stored':
      return {
        level: 'info',
        message: 'stored blocks',
        network,
        fromBlock: outcome.fromBlock,
        toBlock: outcome.toBlock,
        events: outcome.events,
      }
    case 'caught-up':
      return { level: 'info', message: 'caught up', network }
    case 'superseded':
      return { level: 'info', message: 'superseded', network }
    case 'stopped':
      return { level: 'error', message: 'the network stopped', network, reason: outcome.reason }
    case 'failed':
      return { level: 'error', message: 'the cycle failed', network, reason: outcome.error }
    default: {
      const exhaustive: never = outcome
      throw new Error(`unhandled ingest outcome ${String(exhaustive)}`)
    }
  }
}

function entryWithoutUrlCredentials(entry: BackendLogEntry): BackendLogEntry {
  const { level, message, network, ...fields } = entry
  return {
    level,
    message: textWithoutUrlCredentials(message),
    ...(network === undefined ? {} : { network }),
    ...Object.fromEntries(
      Object.entries(fields).map(([name, value]) => [
        name,
        typeof value === 'string' ? textWithoutUrlCredentials(value) : value,
      ]),
    ),
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Whether `work` settled before `ms` passed. */
async function endsWithin(work: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined
  const timedOut = new Promise<false>((resolve) => {
    timer = setTimeout(() => {
      resolve(false)
    }, ms)
  })
  try {
    return await Promise.race([work.then(() => true), timedOut])
  } finally {
    clearTimeout(timer)
  }
}
