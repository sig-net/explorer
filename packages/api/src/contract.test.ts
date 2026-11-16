import {
  bytesToHex,
  calculateRequestId,
  MidnightNetwork,
  parseRequestIdHex,
  SignetEventName,
} from '@sig-net/midnight'
import { describe, expect, it } from 'vitest'

import { createExplorerApiClient } from './client.ts'
import { explorerApiRoutes } from './routes.ts'
import {
  ExplorerApiError,
  type ExplorerNetwork,
  type ExplorerService,
  type InspectedSignBidirectionalLifecycle,
  type LifecyclePage,
  LIFECYCLES_MIN_SEARCH_LENGTH,
} from './service.ts'
import {
  createInMemoryExplorerService,
  EXPLORER_SEED_CASES,
  explorerSeed,
  PREPROD_REQUEST_CELL_WIRE,
  PREPROD_REQUEST_ID,
} from './testing.ts'
import {
  errorWireSchema,
  lifecycleFromWire,
  lifecyclePageWireSchema,
  lifecycleToWire,
  type LifecycleWire,
  lifecycleWireSchema,
  networksToWire,
  resolveLifecyclesQuery,
  textWithoutUrlCredentials,
} from './wire.ts'

const PREPROD = MidnightNetwork.Preprod
const SEED_REQUEST_IDS_NEWEST_FIRST = [
  EXPLORER_SEED_CASES.notInspectedRequestId,
  EXPLORER_SEED_CASES.attestationWithoutRequestId,
  EXPLORER_SEED_CASES.failedInspectionRequestId,
  EXPLORER_SEED_CASES.notifiedTwiceRequestId,
  EXPLORER_SEED_CASES.responseWithoutRequestId,
  EXPLORER_SEED_CASES.completeRequestId,
]

const service = createInMemoryExplorerService(explorerSeed)
const app = explorerApiRoutes(service)
const client = clientOf(service)

function clientOf(served: ExplorerService): ExplorerService {
  const routes = explorerApiRoutes(served)
  return createExplorerApiClient({
    baseUrl: 'http://explorer.test/',
    fetch: (url) => Promise.resolve(routes.request(url)),
  })
}

function clientAnswered(body: BodyInit, status = 200): ExplorerService {
  return createExplorerApiClient({
    baseUrl: 'http://explorer.test',
    fetch: () => Promise.resolve(new Response(body, { status })),
  })
}

async function seedLifecycles(): Promise<readonly InspectedSignBidirectionalLifecycle[]> {
  return (await service.lifecycles(PREPROD)).lifecycles
}

async function seedLifecycle(requestId: string): Promise<InspectedSignBidirectionalLifecycle> {
  const lifecycle = await service.lifecycle(PREPROD, parseRequestIdHex(requestId))
  if (lifecycle === null) {
    throw new Error(`the seed holds no request ${requestId}`)
  }
  return lifecycle
}

/** What a receiver reads after the lifecycle crossed the wire as JSON text. */
function overTheWire(wire: LifecycleWire): InspectedSignBidirectionalLifecycle {
  return lifecycleFromWire(lifecycleWireSchema.parse(JSON.parse(JSON.stringify(wire))))
}

async function errorOf(response: Response | Promise<Response>): Promise<[number, string]> {
  const answered = await response
  return [answered.status, errorWireSchema.parse(await answered.json()).error.code]
}

async function codeOf(call: Promise<unknown>): Promise<string> {
  try {
    await call
  } catch (error) {
    if (error instanceof ExplorerApiError) {
      return error.code
    }
    throw error
  }
  throw new Error('the call did not reject')
}

describe('the wire', () => {
  it('round trips every event kind through the wire', async () => {
    const lifecycles = await seedLifecycles()
    const names = new Set<string>()
    for (const lifecycle of lifecycles) {
      const wire = lifecycleToWire(lifecycle)
      for (const event of wire.events) {
        names.add(event.name)
      }
      expect(wire.events.map((event) => event.id)).toEqual(
        wire.events.map((event) => event.id).toSorted((a, b) => a - b),
      )
      expect(overTheWire(wire)).toEqual(lifecycle)
    }
    expect(lifecycles).toHaveLength(SEED_REQUEST_IDS_NEWEST_FIRST.length)
    expect([...names].toSorted()).toEqual(Object.values(SignetEventName).toSorted())
  })

  it('round trips the request record through the wire', async () => {
    const lifecycle = await seedLifecycle(PREPROD_REQUEST_ID)
    const received = overTheWire(lifecycleToWire(lifecycle))
    const inspection = received.signBidirectionalEvents[0]?.inspection
    if (inspection === undefined || 'failed' in inspection || inspection.request === null) {
      throw new Error('the complete request lost its record')
    }
    expect(bytesToHex(calculateRequestId(inspection.request))).toBe(PREPROD_REQUEST_ID)
    expect(inspection.request).toEqual(
      lifecycle.signBidirectionalEvents.flatMap((event) =>
        'failed' in event.inspection ? [] : [event.inspection.request],
      )[0],
    )
    expect(inspection.callChains[0]?.calls[0]?.entryPoint).toBe('notifySignBidirectional')
  })

  it('a request cell that does not decode becomes a failed inspection', async () => {
    const wire = lifecycleToWire(await seedLifecycle(PREPROD_REQUEST_ID))
    const truncated: LifecycleWire = {
      ...wire,
      events: wire.events.map((event) =>
        event.name === SignetEventName.SignBidirectionalEvent
          ? {
              ...event,
              inspection: {
                callChains: [],
                requestCell: {
                  value: PREPROD_REQUEST_CELL_WIRE.value.slice(0, 5),
                  alignment: PREPROD_REQUEST_CELL_WIRE.alignment.slice(0, 5),
                },
              },
            }
          : event,
      ),
    }
    const received = overTheWire(truncated)
    expect(received.signBidirectionalEvents.map((event) => event.inspection)).toEqual([
      { failed: expect.stringContaining('the request record in the transcript') },
    ])
    expect(received.signatureRespondedEvents).toHaveLength(1)
  })
})

describe('the client over the routes', () => {
  it('client and routes agree over the in-memory service', async () => {
    expect(await client.networks()).toEqual(await service.networks())
    expect(await client.networks()).toHaveLength(2)
    const query = { search: 'C2', excludeCallers: [EXPLORER_SEED_CASES.completeCaller], limit: 3 }
    for (const network of [PREPROD, MidnightNetwork.Preview]) {
      expect(await client.lifecycles(network)).toEqual(await service.lifecycles(network))
      expect(await client.lifecycles(network, query)).toEqual(
        await service.lifecycles(network, query),
      )
      expect(await client.callers(network)).toEqual(await service.callers(network))
    }
    for (const requestId of SEED_REQUEST_IDS_NEWEST_FIRST) {
      const id = parseRequestIdHex(requestId)
      const served = await client.lifecycle(PREPROD, id)
      expect(served).not.toBeNull()
      expect(served).toEqual(await service.lifecycle(PREPROD, id))
    }
    expect(await client.callers(PREPROD)).toEqual(
      [
        EXPLORER_SEED_CASES.completeCaller,
        ...EXPLORER_SEED_CASES.notifiedTwiceCallers,
        EXPLORER_SEED_CASES.failedInspectionCaller,
      ].toSorted(),
    )
  })

  it('pages newest first without repeating or skipping a lifecycle', async () => {
    const seen: string[] = []
    const firstEventIds: number[] = []
    let before: number | undefined
    let pages = 0
    for (;;) {
      const page = await client.lifecycles(PREPROD, { before, limit: 2 })
      pages += 1
      expect(page.lifecycles.length).toBeGreaterThan(0)
      expect(page.lifecycles.length).toBeLessThanOrEqual(2)
      expect(page.matchingRequests).toBe(6)
      for (const lifecycle of page.lifecycles) {
        seen.push(lifecycle.requestId)
        firstEventIds.push(lifecycle.firstEventId)
      }
      if (page.nextBefore === null) {
        break
      }
      expect(page.nextBefore).toBe(page.lifecycles.at(-1)?.firstEventId)
      before = page.nextBefore
    }
    expect(pages).toBe(3)
    expect(seen).toEqual(SEED_REQUEST_IDS_NEWEST_FIRST)
    expect(firstEventIds).toEqual([12, 10, 7, 6, 4, 2])
    expect((await client.lifecycles(PREPROD, { before: 2 })).lifecycles).toEqual([])
  })

  it('searches by a fragment of a request id or a caller', async () => {
    const byRequestId = await client.lifecycles(PREPROD, { search: ' 0xC2C2c2 ' })
    expect(byRequestId.lifecycles.map((lifecycle) => lifecycle.requestId)).toEqual([
      EXPLORER_SEED_CASES.notifiedTwiceRequestId,
    ])
    expect(byRequestId.matchingRequests).toBe(1)
    expect(byRequestId.totalRequests).toBe(6)
    expect(byRequestId.totalEvents).toBe(12)
    const byCaller = await client.lifecycles(PREPROD, {
      search: EXPLORER_SEED_CASES.completeCaller.slice(10, 30).toUpperCase(),
    })
    expect(byCaller.lifecycles.map((lifecycle) => lifecycle.requestId)).toEqual([
      EXPLORER_SEED_CASES.notInspectedRequestId,
      EXPLORER_SEED_CASES.completeRequestId,
    ])
    const bySecondCaller = await client.lifecycles(PREPROD, {
      search: `0x${EXPLORER_SEED_CASES.notifiedTwiceCallers[1]}`,
    })
    expect(bySecondCaller.lifecycles.map((lifecycle) => lifecycle.requestId)).toEqual([
      EXPLORER_SEED_CASES.notifiedTwiceRequestId,
    ])
    expect((await client.lifecycles(PREPROD, { search: 'ffff0000' })).matchingRequests).toBe(0)
    expect((await client.lifecycles(PREPROD, { search: '  ' })).matchingRequests).toBe(6)
  })

  it('excludes callers and keeps a lifecycle that names none', async () => {
    const withoutOne = await client.lifecycles(PREPROD, {
      excludeCallers: [`0x${EXPLORER_SEED_CASES.completeCaller.toUpperCase()}`],
    })
    expect(withoutOne.lifecycles.map((lifecycle) => lifecycle.requestId)).toEqual([
      EXPLORER_SEED_CASES.attestationWithoutRequestId,
      EXPLORER_SEED_CASES.failedInspectionRequestId,
      EXPLORER_SEED_CASES.notifiedTwiceRequestId,
      EXPLORER_SEED_CASES.responseWithoutRequestId,
    ])
    expect(withoutOne.matchingRequests).toBe(4)
    expect(withoutOne.totalRequests).toBe(6)
    const withoutAny = await client.lifecycles(PREPROD, {
      excludeCallers: await client.callers(PREPROD),
    })
    expect(withoutAny.lifecycles.map((lifecycle) => lifecycle.requestId)).toEqual([
      EXPLORER_SEED_CASES.attestationWithoutRequestId,
      EXPLORER_SEED_CASES.responseWithoutRequestId,
    ])
    // One of the two callers of a request is enough to leave it out.
    const withoutSecondCaller = await client.lifecycles(PREPROD, {
      excludeCallers: [EXPLORER_SEED_CASES.notifiedTwiceCallers[1]],
    })
    expect(withoutSecondCaller.matchingRequests).toBe(5)
  })

  it('a page counts the events of the matching requests', async () => {
    const eventsOf = (page: LifecyclePage): number =>
      page.lifecycles.reduce(
        (count, lifecycle) =>
          count +
          lifecycle.signBidirectionalEvents.length +
          lifecycle.signatureRespondedEvents.length +
          lifecycle.respondBidirectionalEvents.length,
        0,
      )
    const all = await client.lifecycles(PREPROD)
    // Two of the twelve events of the seed belong to no request.
    expect(all.totalEvents).toBe(12)
    expect(all.matchingEvents).toBe(10)
    expect(all.matchingEvents).toBe(eventsOf(all))

    const searched = await client.lifecycles(PREPROD, {
      search: EXPLORER_SEED_CASES.completeCaller.slice(10, 30),
    })
    expect(searched.matchingRequests).toBe(2)
    expect(searched.matchingEvents).toBe(4)
    expect(searched.matchingEvents).toBe(eventsOf(searched))

    const excluded = await client.lifecycles(PREPROD, {
      excludeCallers: [EXPLORER_SEED_CASES.notifiedTwiceCallers[1]],
    })
    expect(excluded.matchingRequests).toBe(5)
    expect(excluded.matchingEvents).toBe(7)
    expect(excluded.matchingEvents).toBe(eventsOf(excluded))

    const firstPage = await client.lifecycles(PREPROD, { limit: 2 })
    expect(firstPage.nextBefore).not.toBeNull()
    expect(eventsOf(firstPage)).toBeLessThan(10)
    expect(firstPage.matchingEvents).toBe(10)
    const lastPage = await client.lifecycles(PREPROD, { limit: 2, before: 6 })
    expect(lastPage.lifecycles).toHaveLength(2)
    expect(lastPage.matchingEvents).toBe(10)
    expect((await client.lifecycles(PREPROD, { before: 2 })).matchingEvents).toBe(10)
  })

  it('answers 404 for an unknown network and an unknown request', async () => {
    const unknownRequestId = parseRequestIdHex('ab'.repeat(32))
    for (const path of ['lifecycles', `lifecycles/${unknownRequestId}`, 'callers']) {
      expect(await errorOf(app.request(`/v1/networks/mainnet/${path}`))).toEqual([
        404,
        'unknown_network',
      ])
      expect(await errorOf(app.request(`/v1/networks/nowhere/${path}`))).toEqual([
        404,
        'unknown_network',
      ])
    }
    expect(
      await errorOf(app.request(`/v1/networks/preprod/lifecycles/${unknownRequestId}`)),
    ).toEqual([404, 'not_found'])
    expect(await codeOf(client.lifecycles(MidnightNetwork.Mainnet))).toBe('unknown_network')
    expect(await codeOf(client.callers(MidnightNetwork.Mainnet))).toBe('unknown_network')
    expect(await codeOf(client.lifecycle(MidnightNetwork.Mainnet, unknownRequestId))).toBe(
      'unknown_network',
    )
    expect(await client.lifecycle(PREPROD, unknownRequestId)).toBeNull()
  })

  it('answers 400 for an invalid query', async () => {
    for (const query of [
      'limit=0',
      'limit=201',
      'limit=ten',
      'limit=',
      'limit=1.5',
      'before=-1',
      'before=1e3',
      'excludeCallers=abc',
      `excludeCallers=${EXPLORER_SEED_CASES.completeCaller},`,
      `search=${'a'.repeat(257)}`,
    ]) {
      const answered = await errorOf(app.request(`/v1/networks/preprod/lifecycles?${query}`))
      expect([query, ...answered]).toEqual([query, 400, 'invalid_request'])
    }
    expect(await errorOf(app.request('/v1/networks/preprod/lifecycles/abc'))).toEqual([
      400,
      'invalid_request',
    ])
    expect(await codeOf(client.lifecycles(PREPROD, { limit: 201 }))).toBe('invalid_request')
    expect(await codeOf(service.lifecycles(PREPROD, { limit: 201 }))).toBe('invalid_request')
    expect((await app.request('/v1/networks/preprod/lifecycles?limit=200&before=0')).status).toBe(
      200,
    )
  })

  it('the client rejects a body that does not validate', async () => {
    const wire = lifecycleToWire(await seedLifecycle(PREPROD_REQUEST_ID))
    const otherWire = lifecycleToWire(
      await seedLifecycle(EXPLORER_SEED_CASES.responseWithoutRequestId),
    )
    const requestId = parseRequestIdHex(PREPROD_REQUEST_ID)
    const bodies: [string, (answering: ExplorerService) => Promise<unknown>][] = [
      [JSON.stringify({ networks: [{ network: 'preprod' }] }), (answering) => answering.networks()],
      [JSON.stringify({ callers: ['abc'] }), (answering) => answering.callers(PREPROD)],
      [JSON.stringify({ lifecycles: [] }), (answering) => answering.lifecycles(PREPROD)],
      ['<html>', (answering) => answering.networks()],
      [
        JSON.stringify({ ...wire, events: wire.events.map((event) => ({ ...event, id: -1 })) }),
        (answering) => answering.lifecycle(PREPROD, requestId),
      ],
      // Valid by the schema, and not one lifecycle: an event of another request rides along.
      [
        JSON.stringify({ ...wire, events: [...wire.events, ...otherWire.events] }),
        (answering) => answering.lifecycle(PREPROD, requestId),
      ],
      [
        JSON.stringify({ ...wire, events: wire.events.toReversed() }),
        (answering) => answering.lifecycle(PREPROD, requestId),
      ],
    ]
    for (const [body, call] of bodies) {
      expect([body, await codeOf(call(clientAnswered(body)))]).toEqual([body, 'invalid_response'])
    }
    expect(await codeOf(clientAnswered('{"error":"down"}', 500).networks())).toBe(
      'invalid_response',
    )
    expect(await clientAnswered(JSON.stringify(wire)).lifecycle(PREPROD, requestId)).toEqual(
      await seedLifecycle(PREPROD_REQUEST_ID),
    )
    const unreachable = createExplorerApiClient({
      baseUrl: 'http://explorer.test',
      fetch: () => Promise.reject(new TypeError('fetch failed')),
    })
    expect(await codeOf(unreachable.networks())).toBe('unavailable')
  })

  it('the source url carries no query string', async () => {
    const seeded = explorerSeed.networks.map((network) => network.config.sourceUrl)
    expect(seeded.some((url) => url.includes('?project_id=seed-token'))).toBe(true)
    // A service that hands the routes the URL as configured, token and all.
    const leaking = clientOf({
      ...service,
      networks: () => Promise.resolve([...explorerSeed.networks]),
    })
    for (const answering of [service, client, leaking]) {
      expect((await answering.networks()).map((network) => network.config.sourceUrl)).toEqual([
        'https://indexer.preprod.example/api/v4/graphql',
        'https://indexer.preview.example/api/v4/graphql',
      ])
    }
    const body = await (await app.request('/v1/networks')).text()
    expect(body).not.toContain('seed-token')
    expect(body).not.toContain('?')
    const answered = JSON.stringify({
      networks: [{ ...explorerSeed.networks[1], config: explorerSeed.networks[0]?.config }],
    })
    expect(await codeOf(clientAnswered(answered).networks())).toBe('invalid_response')
  })

  it('the source URL crosses the wire without credentials', async () => {
    const [preprod] = explorerSeed.networks
    if (preprod === undefined) {
      throw new Error('the seed holds no network')
    }
    const configured = {
      ...preprod,
      config: {
        ...preprod.config,
        sourceUrl: 'https://indexer-user:indexer-p@ss@indexer.preprod.example/api/v4/graphql?k=v',
      },
    }
    const cut = 'https://indexer.preprod.example/api/v4/graphql'
    const inMemory = createInMemoryExplorerService({ ...explorerSeed, networks: [configured] })
    const leaking: ExplorerService = { ...service, networks: () => Promise.resolve([configured]) }

    for (const answering of [inMemory, clientOf(leaking)]) {
      expect((await answering.networks()).map((network) => network.config.sourceUrl)).toEqual([cut])
    }
    const body = await (await explorerApiRoutes(leaking).request('/v1/networks')).text()
    expect(body).not.toContain('indexer-user')
    expect(body).not.toContain('ss@')
    const answered = JSON.stringify({
      networks: [
        {
          ...networksToWire([preprod]).networks[0],
          config: { ...preprod.config, sourceUrl: cut.replace('//', '//user:password@') },
        },
      ],
    })
    expect(await codeOf(clientAnswered(answered).networks())).toBe('invalid_response')
  })

  it('a search of fewer than three characters matches every lifecycle', async () => {
    const unsearched = await client.lifecycles(PREPROD)
    expect(unsearched.matchingRequests).toBe(6)
    for (const search of ['ab', '0xab', ' 0XAB ', 'zz']) {
      const page = await client.lifecycles(PREPROD, { search })
      expect(page.matchingRequests).toBe(unsearched.matchingRequests)
      expect(page.matchingEvents).toBe(unsearched.matchingEvents)
      const answered = await app.request(`/v1/networks/preprod/lifecycles?search=${search}`)
      expect(lifecyclePageWireSchema.parse(await answered.json()).matchingRequests).toBe(
        unsearched.matchingRequests,
      )
    }
    for (const search of ['abc', '0xabc']) {
      expect((await client.lifecycles(PREPROD, { search })).matchingRequests).toBe(0)
    }
    expect(resolveLifecyclesQuery({ search: '0xab' }).fragment).toBe('')
    expect(
      resolveLifecyclesQuery({ search: 'a'.repeat(LIFECYCLES_MIN_SEARCH_LENGTH) }).fragment,
    ).toBe('aaa')
  })

  it('a text loses the credentials of every url it holds', () => {
    expect(
      textWithoutUrlCredentials(
        'fetch of "https://indexer.example/api/v4/graphql?project_id=first-token#top" failed, ' +
          'then (wss://indexer-user:indexer-p@ss@indexer.example/ws) closed: code 1006',
      ),
    ).toBe(
      'fetch of "https://indexer.example/api/v4/graphql" failed, ' +
        'then (wss://indexer.example/ws) closed: code 1006',
    )
    expect(textWithoutUrlCredentials('no url here: a?b=c, d@e')).toBe('no url here: a?b=c, d@e')
  })

  it('the error of a network crosses the wire without a token', async () => {
    const [preprod] = explorerSeed.networks
    if (preprod === undefined) {
      throw new Error('the seed holds no network')
    }
    const failing: ExplorerNetwork = {
      ...preprod,
      sync: {
        ...preprod.sync,
        error:
          'request to https://indexer.preprod.example/api/v4/graphql?project_id=error-token failed',
      },
    }
    const leaking: ExplorerService = { ...service, networks: () => Promise.resolve([failing]) }
    expect((await clientOf(leaking).networks()).map((network) => network.sync.error)).toEqual([
      'request to https://indexer.preprod.example/api/v4/graphql failed',
    ])
    const body = await (await explorerApiRoutes(leaking).request('/v1/networks')).text()
    expect(body).not.toContain('error-token')
    expect((await client.networks()).map((network) => network.sync.error)).toEqual([null, null])
  })

  it('a failed inspection crosses the wire without a token', async () => {
    const failed =
      'GET https://indexer.preprod.example/tx/7?project_id=inspection-token answered 502'
    const lifecycle = await seedLifecycle(EXPLORER_SEED_CASES.failedInspectionRequestId)
    const leaking: ExplorerService = {
      ...service,
      lifecycle: () =>
        Promise.resolve({
          ...lifecycle,
          signBidirectionalEvents: lifecycle.signBidirectionalEvents.map((event) => ({
            ...event,
            inspection: { failed },
          })),
        }),
    }
    const requestId = parseRequestIdHex(lifecycle.requestId)
    const received = await clientOf(leaking).lifecycle(PREPROD, requestId)
    expect(received?.signBidirectionalEvents.map((event) => event.inspection)).toEqual([
      { failed: 'GET https://indexer.preprod.example/tx/7 answered 502' },
    ])
    const body = await (
      await explorerApiRoutes(leaking).request(
        `/v1/networks/preprod/lifecycles/${lifecycle.requestId}`,
      )
    ).text()
    expect(body).toContain('indexer.preprod.example/tx/7')
    expect(body).not.toContain('inspection-token')
  })
})

describe('the seed', () => {
  it('the seed holds every case the step lists', async () => {
    const complete = await seedLifecycle(EXPLORER_SEED_CASES.completeRequestId)
    expect(complete.signBidirectionalEvents).toHaveLength(1)
    expect(complete.signatureRespondedEvents).toHaveLength(1)
    expect(complete.respondBidirectionalEvents).toHaveLength(1)
    expect(complete.firstEventId).toBe(2)
    expect(lifecycleToWire(complete).events[0]).toMatchObject({
      inspection: { requestCell: PREPROD_REQUEST_CELL_WIRE },
    })

    for (const requestId of [
      EXPLORER_SEED_CASES.responseWithoutRequestId,
      EXPLORER_SEED_CASES.attestationWithoutRequestId,
    ]) {
      const unrequested = await seedLifecycle(requestId)
      expect(unrequested.signBidirectionalEvents).toEqual([])
      expect(
        unrequested.signatureRespondedEvents.length + unrequested.respondBidirectionalEvents.length,
      ).toBe(1)
    }

    const twice = await seedLifecycle(EXPLORER_SEED_CASES.notifiedTwiceRequestId)
    expect(twice.signBidirectionalEvents.map((event) => event.record.callerAddress)).toEqual(
      EXPLORER_SEED_CASES.notifiedTwiceCallers,
    )
    expect(twice.signBidirectionalEvents.map((event) => event.inspection)).toEqual([
      { callChains: expect.any(Array), request: null, requestCell: null },
      { failed: expect.stringContaining('value atoms') },
    ])

    const failed = await seedLifecycle(EXPLORER_SEED_CASES.failedInspectionRequestId)
    expect(failed.signBidirectionalEvents.map((event) => event.inspection)).toEqual([
      { failed: 'the indexer serves no transaction of this hash' },
    ])
    const notInspected = await seedLifecycle(EXPLORER_SEED_CASES.notInspectedRequestId)
    expect(notInspected.signBidirectionalEvents.map((event) => event.inspection)).toEqual([
      { failed: 'not inspected' },
    ])

    const preprod = explorerSeed.networks[0]
    expect(preprod?.events.map((event) => event.kind).filter((kind) => kind !== 'decoded')).toEqual(
      ['unrecognised', 'undecodable'],
    )
    const networks = await service.networks()
    expect(networks.map((network) => [network.network, network.sync.state])).toEqual([
      ['preprod', 'synced'],
      ['preview', 'starting'],
    ])
    expect(await service.lifecycles(MidnightNetwork.Preview)).toEqual({
      lifecycles: [],
      nextBefore: null,
      matchingRequests: 0,
      matchingEvents: 0,
      totalRequests: 0,
      totalEvents: 0,
    })
  })
})
