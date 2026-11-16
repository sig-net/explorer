import type { SignBidirectionalLifecycle } from '@sig-net/explorer-lib'
import type {
  decodeEvmType2SignBidirectionalEvent,
  MidnightNetwork,
  RequestIdHex,
  SignBidirectionalEvent,
} from '@sig-net/midnight'

/**
 * What the explorer serves about the networks it reads. Every method that takes a network rejects
 * with an {@link ExplorerApiError} of code `unknown_network` when the explorer does not serve it.
 */
export interface ExplorerService {
  /** Every served network. */
  networks(): Promise<ExplorerNetwork[]>
  /**
   * One page of the lifecycles that match `query`, newest first.
   *
   * @throws {ExplorerApiError} `invalid_request` when `query` breaks a bound of
   *   {@link LifecyclesQuery}.
   */
  lifecycles(network: MidnightNetwork, query?: LifecyclesQuery): Promise<LifecyclePage>
  /** The lifecycle of `requestId`, or null when no stored event declares it. */
  lifecycle(
    network: MidnightNetwork,
    requestId: RequestIdHex,
  ): Promise<InspectedSignBidirectionalLifecycle | null>
  /** The distinct caller contract addresses the network's notifications name, in ascending order. */
  callers(network: MidnightNetwork): Promise<string[]>
}

export interface ExplorerNetwork {
  readonly network: MidnightNetwork
  readonly config: ExplorerNetworkConfig
  readonly sync: ExplorerNetworkSync
}

export interface ExplorerNetworkConfig {
  readonly signerContractAddress: string
  readonly responderContractAddress: string
  /** The lowest block height the explorer reads events from. */
  readonly startBlock: number
  /** The indexer's URL as configured, token included: the wire carries it cut of its credentials. */
  readonly sourceUrl: string
}

/** How far the explorer has read a network. Every field but `state` is null until known. */
export interface ExplorerNetworkSync {
  readonly state: ExplorerSyncState
  readonly processedBlock: number | null
  readonly processedBlockTime: Date | null
  readonly tipBlock: number | null
  readonly lastSuccessAt: Date | null
  /** Why the latest read failed, or null when it succeeded. */
  readonly error: string | null
}

export const EXPLORER_SYNC_STATES = ['starting', 'syncing', 'synced', 'stopped'] as const

export type ExplorerSyncState = (typeof EXPLORER_SYNC_STATES)[number]

export interface LifecyclesQuery {
  /**
   * A fragment of a request id or of a caller contract address, in any case and with an optional
   * `0x` prefix. An empty fragment matches every lifecycle.
   */
  readonly search?: string | undefined
  /**
   * Caller contract addresses whose lifecycles are left out. A lifecycle that names no caller is
   * always kept.
   */
  readonly excludeCallers?: readonly string[] | undefined
  /** Keeps the lifecycles whose first event id is below this one: a page's `nextBefore`. */
  readonly before?: number | undefined
  /** The page size, {@link LIFECYCLES_DEFAULT_LIMIT} when omitted. */
  readonly limit?: number | undefined
}

export const LIFECYCLES_DEFAULT_LIMIT = 50

export const LIFECYCLES_MAX_LIMIT = 200

export interface LifecyclePage {
  /** The page, ordered by first event id, descending. */
  readonly lifecycles: readonly InspectedSignBidirectionalLifecycle[]
  /** The `before` of the next page, or null when this page holds the oldest match. */
  readonly nextBefore: number | null
  /** How many lifecycles match the search and the excluded callers, on every page together. */
  readonly matchingRequests: number
  /** How many events those matching lifecycles group, on every page together. */
  readonly matchingEvents: number
  readonly totalRequests: number
  /** Every stored event of the network, including those that joined no lifecycle. */
  readonly totalEvents: number
}

/**
 * A lifecycle as the explorer serves it: the grouped events, the id of the earliest of them, and
 * for each notification what the explorer read in its transaction.
 */
export interface InspectedSignBidirectionalLifecycle extends Omit<
  SignBidirectionalLifecycle,
  'signBidirectionalEvents'
> {
  readonly firstEventId: number
  readonly signBidirectionalEvents: readonly InspectedSignBidirectionalEvent[]
}

export type InspectedSignBidirectionalEvent =
  SignBidirectionalLifecycle['signBidirectionalEvents'][number] & {
    readonly inspection: SignBidirectionalInspection
  }

/** What the explorer read in a notification's transaction, or why it could not. */
export type SignBidirectionalInspection =
  | {
      /** The transaction's top level calls, in transaction order, each the root of its call chain. */
      readonly callChains: readonly ContractCallNode[]
      /**
       * The request record the caller's transcript writes under the notified request id, or null
       * when the transaction holds no such write.
       */
      readonly request: SignBidirectionalEvent | null
      /** The cell `request` is decoded from, which is the form the record crosses the wire in. */
      readonly requestCell: RequestCell | null
    }
  | { readonly failed: string }

/** One contract call of a transaction, with the calls its transcripts claim it made. */
export interface ContractCallNode {
  readonly entryPoint: string
  readonly address: string
  /** Whether any of the call's program runs in the transaction's fallible section. */
  readonly fallible: boolean
  readonly calls: readonly ContractCallNode[]
}

/** A request record as a transcript writes it: the value atoms and their alignment. */
export type RequestCell = Parameters<typeof decodeEvmType2SignBidirectionalEvent>[0]

export class ExplorerApiError extends Error {
  readonly code: ExplorerApiErrorCode

  constructor(code: ExplorerApiErrorCode, message: string) {
    super(message)
    this.name = 'ExplorerApiError'
    this.code = code
  }
}

/**
 * Why a call failed. `invalid_response` is the client's own: the server answered with a body that
 * is not the contract's.
 */
export const EXPLORER_API_ERROR_CODES = [
  'unknown_network',
  'not_found',
  'invalid_request',
  'unavailable',
  'invalid_response',
] as const

export type ExplorerApiErrorCode = (typeof EXPLORER_API_ERROR_CODES)[number]
