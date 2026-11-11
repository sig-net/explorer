import type { IndexedSignetMiscEvent, SignetEventSource } from '@sig-net/midnight'

import {
  aggregateSignBidirectionalLifecycles,
  type SignBidirectionalLifecycle,
} from '@/lib/midnight/sign-bidirectional-lifecycle'
import {
  decodeSignetContractEvent,
  type SignetContractEvent,
  type SignetContractRole,
} from '@/lib/midnight/signet-events'
import { midnightBlocksIn, SIGNET_EVENTS_SLICE_DAYS } from '@/lib/midnight/signet-events-window'

export type IndexedSignetEventSource = SignetEventSource<IndexedSignetMiscEvent>

/**
 * The signer and responder one set of events belongs to, and the indexer they are read from. All
 * three fields together key the store's cache.
 */
export interface SignetEventsLocation {
  readonly indexerUrl: string
  readonly signerContractAddress: string
  readonly responderContractAddress: string
}

/** An inclusive range of block heights. */
export interface SignetEventBlockRange {
  readonly fromBlock: number
  readonly toBlock: number
}

export type SignetEventLoadStatus = 'loading' | 'loaded' | 'error'

export interface SignetEventLoad {
  readonly status: SignetEventLoadStatus
  readonly location: SignetEventsLocation
  /**
   * The blocks read so far. `toBlock` is the chain tip the load was started at, and `fromBlock`
   * falls slice by slice towards `targetFromBlock` as the load reads backwards.
   */
  readonly read: SignetEventBlockRange
  /** The lowest block the load is heading for. Complete when `read.fromBlock` reaches it. */
  readonly targetFromBlock: number
  /** Ascending by id. Covers `read` exactly. */
  readonly events: readonly SignetContractEvent[]
  /** A view of `events`: the decoded ones grouped by declared request id, newest first. */
  readonly lifecycles: readonly SignBidirectionalLifecycle[]
  /** Non-null exactly when status is 'error'. */
  readonly error: string | null
}

export type SignetEventStoreSnapshot = { readonly status: 'unconfigured' } | SignetEventLoad

interface StoreEntry {
  load: SignetEventLoad
  generation: number
  eventSource: IndexedSignetEventSource
  /** True while a slice loop runs for this entry's generation. */
  reading: boolean
}

const UNCONFIGURED: SignetEventStoreSnapshot = { status: 'unconfigured' }

function locationKey(location: SignetEventsLocation): string {
  return JSON.stringify([
    location.indexerUrl,
    location.signerContractAddress,
    location.responderContractAddress,
  ])
}

/** One contract whose events are streamed, and the roles it is configured in. */
interface ContractRead {
  readonly address: string
  readonly roles: readonly SignetContractRole[]
}

/** The distinct contracts of `location`: one when the signer and responder share an address. */
function contractReads(location: SignetEventsLocation): ContractRead[] {
  if (location.signerContractAddress === location.responderContractAddress) {
    return [{ address: location.signerContractAddress, roles: ['signer', 'responder'] }]
  }
  return [
    { address: location.signerContractAddress, roles: ['signer'] },
    { address: location.responderContractAddress, roles: ['responder'] },
  ]
}

/**
 * Holds the signer's and the responder's events per location, reading each location's range
 * through the SDK's event stream one slice of blocks at a time, newest first, so the latest events
 * show while older ones are still arriving. A slice is committed once both contracts' reads of it
 * have finished. A range only grows downwards: selecting a lower starting block extends a load,
 * and a new chain tip or event source starts one afresh. Only completed loads survive a change of
 * location, so a load that stops matching the current location is abandoned and its partial
 * results are dropped.
 */
export class SignetEventStore {
  readonly #entries = new Map<string, StoreEntry>()
  #current: string | null = null
  #generation = 0
  readonly #listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  getSnapshot = (): SignetEventStoreSnapshot => {
    if (this.#current === null) {
      return UNCONFIGURED
    }
    return this.#entries.get(this.#current)?.load ?? UNCONFIGURED
  }

  /**
   * Makes `location` current and ensures the blocks from `fromBlock` to `tipHeight` are loaded
   * through `eventSource`: a load already at that tip through that source is kept and, when
   * `fromBlock` is below what it covers, extended down to it.
   */
  select(
    location: SignetEventsLocation,
    eventSource: IndexedSignetEventSource,
    fromBlock: number,
    tipHeight: number,
  ): void {
    const key = locationKey(location)
    this.#current = key
    this.#prune()
    const entry = this.#entries.get(key)
    if (
      entry === undefined ||
      entry.eventSource !== eventSource ||
      entry.load.read.toBlock !== tipHeight ||
      entry.load.status === 'error'
    ) {
      this.#start(key, location, eventSource, fromBlock, tipHeight)
    } else if (fromBlock < entry.load.targetFromBlock) {
      entry.load = { ...entry.load, status: 'loading', targetFromBlock: fromBlock }
      if (!entry.reading) {
        void this.#read(key, entry.generation)
      }
    }
    this.#notify()
  }

  /** No current location: the snapshot is unconfigured. */
  deselect(): void {
    this.#current = null
    this.#prune()
    this.#notify()
  }

  /** Drops every entry that is not current and not complete. */
  #prune(): void {
    for (const [key, entry] of this.#entries) {
      if (key !== this.#current && entry.load.status !== 'loaded') {
        this.#entries.delete(key)
      }
    }
  }

  #start(
    key: string,
    location: SignetEventsLocation,
    eventSource: IndexedSignetEventSource,
    fromBlock: number,
    tipHeight: number,
  ): void {
    const generation = ++this.#generation
    this.#entries.set(key, {
      load: {
        status: 'loading',
        location,
        read: { fromBlock: tipHeight + 1, toBlock: tipHeight },
        targetFromBlock: fromBlock,
        events: [],
        lifecycles: [],
        error: null,
      },
      generation,
      eventSource,
      reading: false,
    })
    void this.#read(key, generation)
  }

  #live(key: string, generation: number): StoreEntry | null {
    const entry = this.#entries.get(key)
    return entry !== undefined && entry.generation === generation ? entry : null
  }

  /** Reads slices from just below what is read down to the target, oldest slice last. */
  async #read(key: string, generation: number): Promise<void> {
    const entry = this.#live(key, generation)
    if (entry === null) {
      return
    }
    entry.reading = true
    const sliceBlocks = midnightBlocksIn(SIGNET_EVENTS_SLICE_DAYS)
    try {
      for (;;) {
        const current = this.#live(key, generation)
        if (current === null) {
          return
        }
        const { read, targetFromBlock, location } = current.load
        if (read.fromBlock <= targetFromBlock) {
          current.load = { ...current.load, status: 'loaded' }
          this.#notify()
          return
        }
        const slice: SignetEventBlockRange = {
          fromBlock: Math.max(targetFromBlock, read.fromBlock - sliceBlocks),
          toBlock: read.fromBlock - 1,
        }
        const { eventSource } = current
        const contractEvents = await Promise.all(
          contractReads(location).map((contract) =>
            this.#readSlice(key, generation, eventSource, contract, slice),
          ),
        )
        const after = this.#live(key, generation)
        if (after === null) {
          return
        }
        // The indexer's event id is one cursor across contracts, so ascending id is emission order.
        const events = contractEvents.flat().sort((a, b) => a.source.id - b.source.id)
        const merged = [...events, ...after.load.events]
        after.load = {
          ...after.load,
          read: { fromBlock: slice.fromBlock, toBlock: read.toBlock },
          events: merged,
          lifecycles: aggregateSignBidirectionalLifecycles(merged),
        }
        this.#notify()
      }
    } catch (error) {
      const failed = this.#live(key, generation)
      if (failed !== null) {
        failed.load = {
          ...failed.load,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        }
        this.#notify()
      }
    } finally {
      const done = this.#live(key, generation)
      if (done !== null) {
        done.reading = false
      }
    }
  }

  /** One contract's events in `slice`, cut short when the load is abandoned. */
  async #readSlice(
    key: string,
    generation: number,
    eventSource: IndexedSignetEventSource,
    contract: ContractRead,
    slice: SignetEventBlockRange,
  ): Promise<SignetContractEvent[]> {
    const events: SignetContractEvent[] = []
    for await (const event of eventSource.streamSignetEvents(contract.address, slice)) {
      if (this.#live(key, generation) === null) {
        break
      }
      if (event.blockHeight < slice.fromBlock || event.blockHeight > slice.toBlock) {
        throw new Error(
          `the event source yielded block ${String(event.blockHeight)} outside the slice ${String(slice.fromBlock)} to ${String(slice.toBlock)}`,
        )
      }
      events.push(decodeSignetContractEvent(event, contract.roles))
    }
    return events
  }

  #notify(): void {
    for (const listener of this.#listeners) {
      listener()
    }
  }
}
