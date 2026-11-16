import {
  type ErrorWire,
  explorerApiRoutes,
  type ExplorerService,
  textWithoutUrlCredentials,
} from '@sig-net/explorer-api'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import type { CorsOrigins } from '../config/backend-env.ts'

/**
 * The backend's HTTP app: the api routes under `/v1`, CORS for `corsOrigins`, `GET /healthz`
 * and `GET /readyz`. Every failure answers an {@link ErrorWire}.
 */
export function createHttpApp({ service, corsOrigins, ready, logError }: HttpAppOptions): Hono {
  const app = new Hono()
  const allowCors = cors({
    origin: corsOrigins === '*' ? '*' : [...corsOrigins],
    allowMethods: ['GET'],
  })
  app.use('*', (context, next) => {
    const origin = context.req.header('origin')
    return corsOrigins === '*' || (origin !== undefined && corsOrigins.includes(origin))
      ? allowCors(context, next)
      : next()
  })
  app.get('/healthz', (context) => context.json({ status: 'live' }))
  app.get('/readyz', (context) =>
    ready() ? context.json({ status: 'ready' }) : context.json({ status: 'not ready' }, 503),
  )
  app.route('/', explorerApiRoutes(service))
  app.notFound((context) => {
    const wire: ErrorWire = { error: { code: 'not_found', message: 'no such path' } }
    return context.json(wire, 404)
  })
  app.onError((error, context) => {
    logError(
      textWithoutUrlCredentials(`${context.req.method} ${context.req.path}: ${error.message}`),
    )
    const wire: ErrorWire = {
      error: { code: 'unavailable', message: 'the explorer failed to answer' },
    }
    return context.json(wire, 500)
  })
  return app
}

export interface HttpAppOptions {
  readonly service: ExplorerService
  readonly corsOrigins: CorsOrigins
  /** Whether the backend can serve its routes, which `GET /readyz` reports. */
  readonly ready: () => boolean
  /** Receives each unexpected error's message, cut of URL credentials. */
  readonly logError: (message: string) => void
}
