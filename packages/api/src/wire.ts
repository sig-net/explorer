import {
  aggregateSignBidirectionalLifecycles,
  decodeSignetContractEvent,
  parseContractAddressHex,
  type SignetContractRole,
  type StoredSignetMiscEvent,
} from '@sig-net/explorer-lib'
import {
  bytesToHex,
  decodeEvmType2SignBidirectionalEvent,
  hexToBytes,
  MidnightNetwork,
  type SignBidirectionalEvent,
  SignetEventName,
  TxParamType,
} from '@sig-net/midnight'
import { z } from 'zod'

import {
  type ContractCallNode,
  EXPLORER_API_ERROR_CODES,
  EXPLORER_SYNC_STATES,
  ExplorerApiError,
  type ExplorerNetwork,
  type InspectedSignBidirectionalLifecycle,
  type LifecyclePage,
  LIFECYCLES_DEFAULT_LIMIT,
  LIFECYCLES_MAX_LIMIT,
  LIFECYCLES_MIN_SEARCH_LENGTH,
  type LifecyclesQuery,
  type RequestCell,
  type SignBidirectionalInspection,
} from './service.ts'

const hexSchema = z.string().regex(/^(?:[0-9a-f]{2})*$/)
const hash32Schema = z.string().regex(/^[0-9a-f]{64}$/)
const countSchema = z.number().int().nonnegative()
const timeSchema = z.iso.datetime()

const alignmentSchema: z.ZodType<RequestCell['alignment']> = z.lazy(() =>
  z.array(
    z.discriminatedUnion('tag', [
      z.object({ tag: z.literal('option'), value: z.array(alignmentSchema) }),
      z.object({
        tag: z.literal('atom'),
        value: z.discriminatedUnion('tag', [
          z.object({ tag: z.literal('compress') }),
          z.object({ tag: z.literal('field') }),
          z.object({ tag: z.literal('bytes'), length: countSchema }),
        ]),
      }),
    ]),
  ),
)

/** A request cell: each atom as hex, an empty atom as the empty string, the alignment as it is. */
export const requestCellWireSchema = z.object({
  value: z.array(hexSchema),
  alignment: alignmentSchema,
})

export type RequestCellWire = z.infer<typeof requestCellWireSchema>

export const contractCallNodeSchema: z.ZodType<ContractCallNode> = z.lazy(() =>
  z.object({
    entryPoint: z.string(),
    address: z.string(),
    fallible: z.boolean(),
    calls: z.array(contractCallNodeSchema),
  }),
)

const inspectionWireSchema = z.union([
  z.object({
    callChains: z.array(contractCallNodeSchema),
    requestCell: requestCellWireSchema.nullable(),
  }),
  z.object({ failed: z.string() }),
])

export type SignBidirectionalInspectionWire = z.infer<typeof inspectionWireSchema>

const roleSchema = z.enum(['signer', 'responder']) satisfies z.ZodType<SignetContractRole>

const storedEventWireShape = {
  id: countSchema,
  payload: hexSchema,
  transactionHash: hash32Schema,
  blockHeight: countSchema,
  blockHash: hash32Schema,
  blockTime: timeSchema,
  roles: z.array(roleSchema),
}

const lifecycleEventWireSchema = z.discriminatedUnion('name', [
  z.object({
    ...storedEventWireShape,
    name: z.literal(SignetEventName.SignBidirectionalEvent),
    inspection: inspectionWireSchema,
  }),
  z.object({
    ...storedEventWireShape,
    name: z.literal(SignetEventName.SignatureRespondedEvent),
  }),
  z.object({
    ...storedEventWireShape,
    name: z.literal(SignetEventName.RespondBidirectionalEvent),
  }),
])

type LifecycleEventWire = z.infer<typeof lifecycleEventWireSchema>

/** A lifecycle on the wire: every event that declares `requestId`, in emission order. */
export const lifecycleWireSchema = z.object({
  requestId: hash32Schema,
  firstEventId: countSchema,
  events: z.array(lifecycleEventWireSchema),
})

export type LifecycleWire = z.infer<typeof lifecycleWireSchema>

export function lifecycleToWire(lifecycle: InspectedSignBidirectionalLifecycle): LifecycleWire {
  const events: LifecycleEventWire[] = [
    ...lifecycle.signBidirectionalEvents.map((event) => ({
      ...storedEventToWire(event.source, event.roles),
      name: event.name,
      inspection: inspectionToWire(event.inspection),
    })),
    ...lifecycle.signatureRespondedEvents.map((event) => ({
      ...storedEventToWire(event.source, event.roles),
      name: event.name,
    })),
    ...lifecycle.respondBidirectionalEvents.map((event) => ({
      ...storedEventToWire(event.source, event.roles),
      name: event.name,
    })),
  ]
  return {
    requestId: lifecycle.requestId,
    firstEventId: lifecycle.firstEventId,
    events: events.sort((a, b) => a.id - b.id),
  }
}

/**
 * Decodes a wire lifecycle with the decoders the explorer stores events with.
 *
 * @throws {ExplorerApiError} `invalid_response` when the events are not one lifecycle of
 *   `requestId` in emission order: an event that does not decode, declares another request id, or
 *   is out of order.
 */
export function lifecycleFromWire(wire: LifecycleWire): InspectedSignBidirectionalLifecycle {
  const inspections = new Map<number, SignBidirectionalInspectionWire>()
  let previousId = -1
  const events = wire.events.map((event) => {
    if (event.id <= previousId) {
      throw new ExplorerApiError(
        'invalid_response',
        `the events of request ${wire.requestId} are not in emission order`,
      )
    }
    previousId = event.id
    if (event.name === SignetEventName.SignBidirectionalEvent) {
      inspections.set(event.id, event.inspection)
    }
    const source: StoredSignetMiscEvent = {
      id: event.id,
      name: event.name,
      payload: hexToBytes(event.payload),
      transactionHash: event.transactionHash,
      blockHeight: event.blockHeight,
      blockHash: event.blockHash,
      blockTimestamp: new Date(event.blockTime),
    }
    return decodeSignetContractEvent(source, event.roles)
  })
  const [lifecycle, ...others] = aggregateSignBidirectionalLifecycles(events)
  if (
    lifecycle === undefined ||
    others.length > 0 ||
    lifecycle.requestId !== wire.requestId ||
    wire.events[0]?.id !== wire.firstEventId ||
    events.some((event) => event.kind !== 'decoded')
  ) {
    throw new ExplorerApiError(
      'invalid_response',
      `the events served for request ${wire.requestId} are not one lifecycle of that request`,
    )
  }
  return {
    ...lifecycle,
    firstEventId: wire.firstEventId,
    signBidirectionalEvents: lifecycle.signBidirectionalEvents.map((event) => {
      const inspection = inspections.get(event.source.id)
      if (inspection === undefined) {
        throw new ExplorerApiError(
          'invalid_response',
          `event ${String(event.source.id)} carries no inspection`,
        )
      }
      return { ...event, inspection: inspectionFromWire(inspection) }
    }),
  }
}

/**
 * Decodes a wire inspection. A request cell that is not a decodable evmType2 request record makes
 * the inspection a failed one, with the decoder's reason.
 */
export function inspectionFromWire(
  wire: SignBidirectionalInspectionWire,
): SignBidirectionalInspection {
  if ('failed' in wire) {
    return { failed: wire.failed }
  }
  if (wire.requestCell === null) {
    return { callChains: wire.callChains, request: null, requestCell: null }
  }
  let requestCell: RequestCell
  let request: SignBidirectionalEvent
  try {
    requestCell = {
      value: wire.requestCell.value.map((atom) => hexToBytes(atom)),
      alignment: wire.requestCell.alignment,
    }
    request = decodeEvmType2SignBidirectionalEvent(
      requestCell,
      'the request record in the transcript',
    )
    if (request.txParamType !== TxParamType.evmType2) {
      throw new Error(`unsupported txParamType ${String(request.txParamType)}`)
    }
  } catch (error) {
    return { failed: error instanceof Error ? error.message : String(error) }
  }
  return { callChains: wire.callChains, request, requestCell }
}

function inspectionToWire(
  inspection: SignBidirectionalInspection,
): SignBidirectionalInspectionWire {
  if ('failed' in inspection) {
    return { failed: textWithoutUrlCredentials(inspection.failed) }
  }
  const { callChains, requestCell } = inspection
  return {
    callChains: [...callChains],
    requestCell:
      requestCell === null
        ? null
        : {
            value: requestCell.value.map((atom) => bytesToHex(atom)),
            alignment: requestCell.alignment,
          },
  }
}

function storedEventToWire(source: StoredSignetMiscEvent, roles: readonly SignetContractRole[]) {
  return {
    id: source.id,
    payload: bytesToHex(source.payload),
    transactionHash: source.transactionHash,
    blockHeight: source.blockHeight,
    blockHash: source.blockHash,
    blockTime: source.blockTimestamp.toISOString(),
    roles: [...roles],
  }
}

export const lifecyclePageWireSchema = z.object({
  lifecycles: z.array(lifecycleWireSchema),
  nextBefore: countSchema.nullable(),
  matchingRequests: countSchema,
  matchingEvents: countSchema,
  totalRequests: countSchema,
  totalEvents: countSchema,
})

export type LifecyclePageWire = z.infer<typeof lifecyclePageWireSchema>

export function lifecyclePageToWire(page: LifecyclePage): LifecyclePageWire {
  return { ...page, lifecycles: page.lifecycles.map(lifecycleToWire) }
}

/** @throws {ExplorerApiError} As {@link lifecycleFromWire} does, for any lifecycle of the page. */
export function lifecyclePageFromWire(wire: LifecyclePageWire): LifecyclePage {
  return { ...wire, lifecycles: wire.lifecycles.map(lifecycleFromWire) }
}

const networkWireSchema = z.object({
  network: z.enum(MidnightNetwork),
  config: z.object({
    signerContractAddress: z.string(),
    responderContractAddress: z.string(),
    startBlock: countSchema,
    sourceUrl: z.string().refine((url) => url === urlWithoutCredentials(url)),
  }),
  sync: z.object({
    state: z.enum(EXPLORER_SYNC_STATES),
    processedBlock: countSchema.nullable(),
    processedBlockTime: timeSchema.nullable(),
    tipBlock: countSchema.nullable(),
    lastSuccessAt: timeSchema.nullable(),
    error: z.string().nullable(),
  }),
})

export const networksWireSchema = z.object({ networks: z.array(networkWireSchema) })

export type NetworksWire = z.infer<typeof networksWireSchema>

/** The wire form of `networks`, the source URL and the sync error without URL credentials. */
export function networksToWire(networks: readonly ExplorerNetwork[]): NetworksWire {
  return {
    networks: networks.map(({ network, config, sync }) => ({
      network,
      config: { ...config, sourceUrl: urlWithoutCredentials(config.sourceUrl) },
      sync: {
        ...sync,
        processedBlockTime: sync.processedBlockTime?.toISOString() ?? null,
        lastSuccessAt: sync.lastSuccessAt?.toISOString() ?? null,
        error: sync.error === null ? null : textWithoutUrlCredentials(sync.error),
      },
    })),
  }
}

export function networksFromWire(wire: NetworksWire): ExplorerNetwork[] {
  return wire.networks.map(({ network, config, sync }) => ({
    network,
    config,
    sync: {
      ...sync,
      processedBlockTime:
        sync.processedBlockTime === null ? null : new Date(sync.processedBlockTime),
      lastSuccessAt: sync.lastSuccessAt === null ? null : new Date(sync.lastSuccessAt),
    },
  }))
}

/** `url` without its user and password and cut before its query string or fragment. */
export function urlWithoutCredentials(url: string): string {
  return url.replace(/[?#].*$/s, '').replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/\\]*@/i, '$1')
}

/**
 * `text` with every URL it holds cut as {@link urlWithoutCredentials} cuts one, in time linear in
 * the length of `text`. A user and password run to the last `@` before the path, and a query
 * string or fragment to the next white space, less the closing punctuation that ends it.
 */
export function textWithoutUrlCredentials(text: string): string {
  return text.replace(/\S+/g, wordWithoutUrlCredentials)
}

const URL_SCHEME_LETTER = /[a-z]/i
const URL_SCHEME_SYMBOL = /[0-9+.-]/
const URL_USER_INFO_CHARACTERS = /[^/\\?#]*/y
const URL_QUERY_START = /[?#]/g
const URL_CLOSING_PUNCTUATION = new Set('"\'`)]}>.,:;')

/** `word`, which holds no white space, with its URLs cut. */
function wordWithoutUrlCredentials(word: string): string {
  if (!word.includes('://')) {
    return word
  }
  let withoutUserInfo = ''
  let copied = 0
  let authority = urlAuthorityStart(word, 0)
  while (authority !== -1) {
    URL_USER_INFO_CHARACTERS.lastIndex = authority
    const userInfoEnd = (URL_USER_INFO_CHARACTERS.exec(word)?.[0] ?? '').lastIndexOf('@')
    if (userInfoEnd !== -1) {
      withoutUserInfo += word.slice(copied, authority)
      copied = authority + userInfoEnd + 1
    }
    authority = urlAuthorityStart(word, Math.max(authority, copied))
  }
  withoutUserInfo += word.slice(copied)

  const firstAuthority = urlAuthorityStart(withoutUserInfo, 0)
  if (firstAuthority === -1) {
    return withoutUserInfo
  }
  URL_QUERY_START.lastIndex = firstAuthority
  const queryStart = URL_QUERY_START.exec(withoutUserInfo)?.index
  if (queryStart === undefined) {
    return withoutUserInfo
  }
  let closingStart = withoutUserInfo.length
  while (
    closingStart > queryStart + 1 &&
    URL_CLOSING_PUNCTUATION.has(withoutUserInfo.charAt(closingStart - 1))
  ) {
    closingStart -= 1
  }
  return withoutUserInfo.slice(0, queryStart) + withoutUserInfo.slice(closingStart)
}

/** The index after the first `://` at or after `from` that a scheme precedes, or -1. */
function urlAuthorityStart(text: string, from: number): number {
  for (let at = text.indexOf('://', from); at !== -1; at = text.indexOf('://', at + 3)) {
    for (let before = at - 1; before >= 0; before -= 1) {
      const character = text.charAt(before)
      if (URL_SCHEME_LETTER.test(character)) {
        return at + 3
      }
      if (!URL_SCHEME_SYMBOL.test(character)) {
        break
      }
    }
  }
  return -1
}

export const callersWireSchema = z.object({ callers: z.array(hash32Schema) })

export const errorWireSchema = z.object({
  error: z.object({ code: z.enum(EXPLORER_API_ERROR_CODES), message: z.string() }),
})

export type ErrorWire = z.infer<typeof errorWireSchema>

const LIFECYCLES_MAX_SEARCH_LENGTH = 256
const LIFECYCLES_MAX_EXCLUDED_CALLERS = 100

const lifecyclesQuerySchema = z.object({
  search: z.string().max(LIFECYCLES_MAX_SEARCH_LENGTH).optional(),
  excludeCallers: z
    .array(
      z.string().transform((value, context) => {
        const address = parseContractAddressHex(value)
        if (address === null) {
          context.addIssue({ code: 'custom', message: 'not a contract address' })
          return z.NEVER
        }
        return address
      }),
    )
    .max(LIFECYCLES_MAX_EXCLUDED_CALLERS)
    .optional(),
  before: countSchema.optional(),
  limit: z.number().int().min(1).max(LIFECYCLES_MAX_LIMIT).optional(),
})

/** A {@link LifecyclesQuery} with its defaults applied and its values in canonical form. */
export interface ResolvedLifecyclesQuery {
  /**
   * The search in lower case without `0x` and surrounding space, or the empty string, which
   * matches every lifecycle, when that is shorter than {@link LIFECYCLES_MIN_SEARCH_LENGTH}.
   */
  readonly fragment: string
  readonly excludeCallers: readonly string[]
  readonly before: number | null
  readonly limit: number
}

/** @throws {ExplorerApiError} `invalid_request` when `query` breaks a bound. */
export function resolveLifecyclesQuery(query: LifecyclesQuery = {}): ResolvedLifecyclesQuery {
  const parsed = lifecyclesQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw new ExplorerApiError('invalid_request', z.prettifyError(parsed.error))
  }
  const { search, excludeCallers, before, limit } = parsed.data
  const fragment = (search ?? '').trim().toLowerCase().replace(/^0x/, '')
  return {
    fragment: fragment.length < LIFECYCLES_MIN_SEARCH_LENGTH ? '' : fragment,
    excludeCallers: excludeCallers ?? [],
    before: before ?? null,
    limit: limit ?? LIFECYCLES_DEFAULT_LIMIT,
  }
}

/** The query string of a lifecycles call: `excludeCallers` is a comma-separated list. */
export function lifecyclesQueryToSearchParams(query: LifecyclesQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.search !== undefined) {
    params.set('search', query.search)
  }
  if (query.excludeCallers !== undefined && query.excludeCallers.length > 0) {
    params.set('excludeCallers', query.excludeCallers.join(','))
  }
  if (query.before !== undefined) {
    params.set('before', String(query.before))
  }
  if (query.limit !== undefined) {
    params.set('limit', String(query.limit))
  }
  return params
}

/**
 * Reads a lifecycles query string. A `before` or `limit` that is not a run of digits becomes NaN,
 * which {@link resolveLifecyclesQuery} rejects.
 */
export function lifecyclesQueryFromSearchParams(params: URLSearchParams): LifecyclesQuery {
  const integer = (name: string): number | undefined => {
    const value = params.get(name)
    if (value === null) {
      return undefined
    }
    return /^\d+$/.test(value) ? Number(value) : Number.NaN
  }
  const excludeCallers = params.get('excludeCallers')
  return {
    search: params.get('search') ?? undefined,
    excludeCallers:
      excludeCallers === null || excludeCallers === '' ? undefined : excludeCallers.split(','),
    before: integer('before'),
    limit: integer('limit'),
  }
}
