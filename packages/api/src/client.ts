import type { MidnightNetwork, RequestIdHex } from '@sig-net/midnight'
import type { z } from 'zod'

import {
  ExplorerApiError,
  type ExplorerNetwork,
  type ExplorerService,
  type InspectedSignBidirectionalLifecycle,
  type LifecyclePage,
  type LifecyclesQuery,
} from './service.ts'
import {
  callersWireSchema,
  errorWireSchema,
  lifecycleFromWire,
  lifecyclePageFromWire,
  lifecyclePageWireSchema,
  lifecyclesQueryToSearchParams,
  lifecycleWireSchema,
  networksFromWire,
  networksWireSchema,
} from './wire.ts'

/**
 * An {@link ExplorerService} over HTTP. Every method rejects with an {@link ExplorerApiError}: the
 * server's own code, `unavailable` when no answer arrives, `invalid_response` when the answer is
 * not the contract's.
 */
export function createExplorerApiClient(options: ExplorerApiClientOptions): ExplorerService {
  const base = options.baseUrl.replace(/\/+$/, '')
  const fetchUrl: ExplorerApiFetch = options.fetch ?? ((url) => fetch(url))

  async function get<TWire>(path: string, schema: z.ZodType<TWire>): Promise<TWire> {
    let response: Response
    let body: unknown
    try {
      response = await fetchUrl(`${base}/v1${path}`)
    } catch (error) {
      throw new ExplorerApiError(
        'unavailable',
        `the explorer API did not answer: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    try {
      body = await response.json()
    } catch {
      throw new ExplorerApiError(
        'invalid_response',
        `the explorer API answered ${String(response.status)} with a body that is not JSON`,
      )
    }
    if (!response.ok) {
      const failure = errorWireSchema.safeParse(body)
      throw failure.success
        ? new ExplorerApiError(failure.data.error.code, failure.data.error.message)
        : new ExplorerApiError(
            'invalid_response',
            `the explorer API answered ${String(response.status)} with no error of the contract`,
          )
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw new ExplorerApiError(
        'invalid_response',
        `the explorer API answered ${path} with a body that does not validate`,
      )
    }
    return parsed.data
  }

  return {
    async networks(): Promise<ExplorerNetwork[]> {
      return networksFromWire(await get('/networks', networksWireSchema))
    },
    async lifecycles(
      network: MidnightNetwork,
      query: LifecyclesQuery = {},
    ): Promise<LifecyclePage> {
      const params = lifecyclesQueryToSearchParams(query).toString()
      const path = `/networks/${network}/lifecycles${params === '' ? '' : `?${params}`}`
      return lifecyclePageFromWire(await get(path, lifecyclePageWireSchema))
    },
    async lifecycle(
      network: MidnightNetwork,
      requestId: RequestIdHex,
    ): Promise<InspectedSignBidirectionalLifecycle | null> {
      try {
        const wire = await get(`/networks/${network}/lifecycles/${requestId}`, lifecycleWireSchema)
        return lifecycleFromWire(wire)
      } catch (error) {
        if (error instanceof ExplorerApiError && error.code === 'not_found') {
          return null
        }
        throw error
      }
    },
    async callers(network: MidnightNetwork): Promise<string[]> {
      return (await get(`/networks/${network}/callers`, callersWireSchema)).callers
    },
  }
}

export interface ExplorerApiClientOptions {
  /** Where the API is served, without the `/v1` the client adds. */
  readonly baseUrl: string
  /** The global `fetch` when omitted. */
  readonly fetch?: ExplorerApiFetch | undefined
}

/** The part of `fetch` the client uses: a GET of an absolute URL. */
export type ExplorerApiFetch = (url: string) => Promise<Response>
