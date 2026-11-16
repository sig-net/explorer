import { type ChildProcess, spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from './db/testing.ts'

const MAIN = fileURLToPath(new URL('./main.ts', import.meta.url))
const TEST_TIMEOUT_MS = 60_000

let database: TestDatabase
let children: ChildProcess[]

beforeAll(async () => {
  database = await createTestDatabase()
  children = []
})

afterEach(() => {
  for (const child of children) {
    child.kill('SIGKILL')
  }
})

afterAll(async () => {
  await database.drop()
})

interface RunningMain {
  readonly child: ChildProcess
  /** What the child has written to stdout. */
  stdout(): string
  /** The exit code, or the signal that ended the child. */
  readonly exit: Promise<number | NodeJS.Signals | null>
}

/** Starts the backend serving `undeployed` on `port`, with the rest of `env`. */
function runMain(port: number, env: Readonly<Record<string, string>>): RunningMain {
  const child = spawn(process.execPath, [MAIN], {
    env: {
      PATH: process.env['PATH'],
      EXPLORER_HOST: '127.0.0.1',
      EXPLORER_PORT: String(port),
      EXPLORER_CORS_ORIGINS: '*',
      EXPLORER_MIDNIGHT_NETWORKS: 'undeployed',
      EXPLORER_MIDNIGHT_UNDEPLOYED_SIGNER_CONTRACT_ADDRESS: 'a0'.repeat(32),
      EXPLORER_MIDNIGHT_UNDEPLOYED_RESPONDER_CONTRACT_ADDRESS: 'b0'.repeat(32),
      EXPLORER_MIDNIGHT_UNDEPLOYED_START_BLOCK: '0',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  children.push(child)
  let stdout = ''
  child.stdout?.setEncoding('utf8')
  child.stdout?.on('data', (chunk: string) => {
    stdout += chunk
  })
  const exit = new Promise<number | NodeJS.Signals | null>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => {
      resolve(code ?? signal)
    })
  })
  return { child, stdout: () => stdout, exit }
}

/** A port of 127.0.0.1 that nothing listened on a moment ago. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (address === null || typeof address === 'string') {
          reject(new Error('the system gave no port'))
        } else {
          resolve(address.port)
        }
      })
    })
  })
}

function linesOf(stdout: string): string[] {
  return stdout.split('\n').filter((line) => line !== '')
}

function messagesOf(stdout: string): unknown[] {
  return linesOf(stdout).map((line) => {
    const entry: unknown = JSON.parse(line)
    return typeof entry === 'object' && entry !== null && 'message' in entry ? entry.message : null
  })
}

async function waitFor(
  what: string,
  main: RunningMain,
  holds: () => Promise<boolean>,
): Promise<void> {
  const deadline = Date.now() + 45_000
  while (!(await holds())) {
    if (Date.now() > deadline) {
      throw new Error(`waited 45 s for ${what}: ${main.stdout()}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

async function isReady(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${String(port)}/readyz`)
    await response.body?.cancel()
    return response.status === 200
  } catch {
    return false
  }
}

describe('main', () => {
  it(
    'SIGTERM ends the process cleanly',
    async () => {
      const port = await freePort()
      const indexerPort = await freePort()
      const main = runMain(port, {
        EXPLORER_DATABASE_URL: database.url,
        EXPLORER_MIDNIGHT_UNDEPLOYED_INDEXER_URL: `http://127.0.0.1:${String(indexerPort)}/api/v4/graphql?key=secret`,
      })

      await waitFor('the backend to be ready', main, () => isReady(port))
      expect(messagesOf(main.stdout())).toContain('listening')
      main.child.kill('SIGTERM')

      expect(await main.exit).toBe(0)
      const lines = linesOf(main.stdout())
      for (const line of lines) {
        const entry: unknown = JSON.parse(line)
        expect(entry).toMatchObject({
          time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/u),
          level: expect.stringMatching(/^(?:info|error)$/u),
          message: expect.any(String),
        })
      }
      expect(messagesOf(main.stdout()).slice(-2)).toEqual(['shutting down', 'shut down'])
      expect(main.stdout()).not.toContain('secret')
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'a database that does not answer at start exits 1',
    async () => {
      const port = await freePort()
      const databasePort = await freePort()
      const main = runMain(port, {
        EXPLORER_DATABASE_URL: `postgres://explorer:secret@127.0.0.1:${String(databasePort)}/explorer`,
        EXPLORER_MIDNIGHT_UNDEPLOYED_INDEXER_URL: 'http://127.0.0.1:1/api/v4/graphql',
      })

      expect(await main.exit).toBe(1)
      expect(messagesOf(main.stdout())).toContain('the migration failed')
      expect(main.stdout()).not.toContain('secret')
    },
    TEST_TIMEOUT_MS,
  )
})
