import { isMidnightNetwork } from '@sig-net/explorer-lib'
import { type MidnightNetwork, parseRequestIdHex, type RequestIdHex } from '@sig-net/midnight'
import { type Context, Hono } from 'hono'

import { ExplorerApiError, type ExplorerApiErrorCode, type ExplorerService } from './service.ts'
import {
  type ErrorWire,
  lifecyclePageToWire,
  lifecyclesQueryFromSearchParams,
  lifecycleToWire,
  networksToWire,
} from './wire.ts'

/**
 * `service` over HTTP, as the routes under `/v1` that the client of this package calls. An error
 * that is not an {@link ExplorerApiError} leaves through the app this one is mounted in.
 */
export function explorerApiRoutes(service: ExplorerService): Hono {
  const app = new Hono().basePath('/v1')
  app.get('/networks', (context) =>
    answer(context, async () => networksToWire(await service.networks())),
  )
  app.get('/networks/:network/lifecycles', (context) =>
    answer(context, async () => {
      const query = lifecyclesQueryFromSearchParams(new URL(context.req.url).searchParams)
      const page = await service.lifecycles(networkOf(context.req.param('network')), query)
      return lifecyclePageToWire(page)
    }),
  )
  app.get('/networks/:network/lifecycles/:requestId', (context) =>
    answer(context, async () => {
      const requestId = requestIdOf(context.req.param('requestId'))
      const lifecycle = await service.lifecycle(networkOf(context.req.param('network')), requestId)
      if (lifecycle === null) {
        throw new ExplorerApiError('not_found', `no event declares request ${requestId}`)
      }
      return lifecycleToWire(lifecycle)
    }),
  )
  app.get('/networks/:network/callers', (context) =>
    answer(context, async () => ({
      callers: await service.callers(networkOf(context.req.param('network'))),
    })),
  )
  return app
}

const ERROR_STATUS = {
  unknown_network: 404,
  not_found: 404,
  invalid_request: 400,
  unavailable: 503,
  invalid_response: 502,
} as const satisfies Record<ExplorerApiErrorCode, number>

async function answer(context: Context, body: () => Promise<object>): Promise<Response> {
  try {
    return context.json(await body())
  } catch (error) {
    if (!(error instanceof ExplorerApiError)) {
      throw error
    }
    const wire: ErrorWire = { error: { code: error.code, message: error.message } }
    return context.json(wire, ERROR_STATUS[error.code])
  }
}

function networkOf(value: string): MidnightNetwork {
  if (!isMidnightNetwork(value)) {
    throw new ExplorerApiError('unknown_network', `${value} is not a Midnight network`)
  }
  return value
}

function requestIdOf(value: string): RequestIdHex {
  try {
    return parseRequestIdHex(value)
  } catch {
    throw new ExplorerApiError('invalid_request', 'the request id is not 32 bytes of hex')
  }
}
