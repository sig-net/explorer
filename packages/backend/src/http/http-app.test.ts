import {
  createExplorerApiClient,
  errorWireSchema,
  explorerApiRoutes,
  type ExplorerService,
} from '@sig-net/explorer-api'
import {
  createInMemoryExplorerService,
  EXPLORER_SEED_CASES,
  explorerSeed,
} from '@sig-net/explorer-api/testing'
import { MidnightNetwork, parseRequestIdHex } from '@sig-net/midnight'
import type { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

import { createHttpApp, type HttpAppOptions } from './http-app.ts'

const ALLOWED_ORIGIN = 'https://sig-net.github.io'

function appWith(options: Partial<HttpAppOptions> = {}): Hono {
  return createHttpApp({
    service: createInMemoryExplorerService(explorerSeed),
    corsOrigins: [ALLOWED_ORIGIN, 'http://localhost:5173'],
    ready: () => true,
    logError: () => undefined,
    ...options,
  })
}

function clientOver(app: Hono): ExplorerService {
  return createExplorerApiClient({
    baseUrl: 'http://explorer.test',
    fetch: (url) => Promise.resolve(app.request(url)),
  })
}

function corsHeadersOf(response: Response): string[] {
  return [...response.headers.keys()].filter((name) => name.startsWith('access-control-'))
}

describe('createHttpApp', () => {
  it('answers a preflight and a GET for an allowed origin', async () => {
    const app = appWith()
    const preflight = await app.request('/v1/networks', {
      method: 'OPTIONS',
      headers: { origin: ALLOWED_ORIGIN, 'access-control-request-method': 'GET' },
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN)
    expect(preflight.headers.get('access-control-allow-methods')).toBe('GET')

    const get = await app.request('/v1/networks', { headers: { origin: ALLOWED_ORIGIN } })
    expect(get.status).toBe(200)
    expect(get.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN)

    const anyOrigin = await appWith({ corsOrigins: '*' }).request('/v1/networks', {
      headers: { origin: 'https://elsewhere.test' },
    })
    expect(anyOrigin.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('sends no CORS header to another origin', async () => {
    const app = appWith()
    const preflight = await app.request('/v1/networks', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://elsewhere.test',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'x-custom',
      },
    })
    expect(corsHeadersOf(preflight)).toEqual([])
    const get = await app.request('/v1/networks', { headers: { origin: 'https://elsewhere.test' } })
    expect(get.status).toBe(200)
    expect(corsHeadersOf(get)).toEqual([])
  })

  it('healthz is 200 and readyz follows ready', async () => {
    let ready = false
    const app = appWith({ ready: () => ready })
    expect((await app.request('/healthz')).status).toBe(200)
    expect((await app.request('/readyz')).status).toBe(503)
    ready = true
    expect((await app.request('/readyz')).status).toBe(200)
    expect((await app.request('/healthz')).status).toBe(200)
  })

  it('serves the api routes over the in-memory service', async () => {
    const service = createInMemoryExplorerService(explorerSeed)
    const served = clientOver(appWith({ service }))
    const reference = createExplorerApiClient({
      baseUrl: 'http://explorer.test',
      fetch: (url) => Promise.resolve(explorerApiRoutes(service).request(url)),
    })
    const network = MidnightNetwork.Preprod
    const requestId = parseRequestIdHex(EXPLORER_SEED_CASES.completeRequestId)
    expect(await served.networks()).toEqual(await reference.networks())
    expect(await served.lifecycles(network, { limit: 3 })).toEqual(
      await reference.lifecycles(network, { limit: 3 }),
    )
    const lifecycle = await served.lifecycle(network, requestId)
    expect(lifecycle?.requestId).toBe(EXPLORER_SEED_CASES.completeRequestId)
    expect(lifecycle).toEqual(await reference.lifecycle(network, requestId))
    expect(await served.callers(network)).toEqual(await reference.callers(network))
    await expect(served.callers(MidnightNetwork.Mainnet)).rejects.toMatchObject({
      code: 'unknown_network',
    })
  })

  it("an unknown path answers not_found in the api's error body", async () => {
    for (const path of ['/nowhere', '/v1/nowhere', '/v2/networks']) {
      const response = await appWith().request(path)
      expect(response.status).toBe(404)
      const body = errorWireSchema.parse(await response.json())
      expect(body.error.code).toBe('not_found')
    }
  })

  it('an unexpected error answers 500 with no detail and is logged without a token', async () => {
    const logged: string[] = []
    const failing: ExplorerService = {
      ...createInMemoryExplorerService(explorerSeed),
      networks: () =>
        Promise.reject(
          new Error(
            'connect ECONNREFUSED for https://user:password@indexer.test/graphql?project_id=secret-token',
          ),
        ),
    }
    const response = await appWith({
      service: failing,
      logError: (message) => logged.push(message),
    }).request('/v1/networks')
    expect(response.status).toBe(500)
    const text = await response.text()
    const body = errorWireSchema.parse(JSON.parse(text))
    expect(body.error.code).toBe('unavailable')
    expect(text).not.toMatch(/ECONNREFUSED|indexer\.test|secret-token|password/u)
    expect(logged).toHaveLength(1)
    expect(logged[0]).toContain('ECONNREFUSED')
    expect(logged[0]).toContain('https://indexer.test/graphql')
    expect(logged[0]).not.toMatch(/secret-token|password/u)
  })
})
