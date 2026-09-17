import type { IndexedSignetMiscEvent, SignetEventSource } from '@sig-net/midnight'

import { decodeSignetContractEvent, type SignetContractEvent } from '@/lib/midnight/signet-events'

export type IndexedSignetEventSource = SignetEventSource<IndexedSignetMiscEvent>

/** The contract one set of events belongs to. Both fields together key the store's cache. */
export interface SignetContractLocation {
  readonly indexerUrl: string
  readonly signetContractAddress: string
}

export type SignetEventLoadStatus = 'loading' | 'loaded' | 'error'

export interface SignetEventLoad {
  readonly status: SignetEventLoadStatus
  readonly location: SignetContractLocation
  /** Ascending by id. Complete when status is 'loaded'. */
  readonly events: readonly SignetContractEvent[]
  /** The indexer tip pinned by the first page, null until it arrives. */
  readonly tipId: number | null
  /** Id of the last loaded event, null before the first. */
  readonly lastId: number | null
  /** Non-null exactly when status is 'error'. */
  readonly error: string | null
}

export type SignetEventStoreSnapshot = { readonly status: 'unconfigured' } | SignetEventLoad

interface StoreEntry {
  load: SignetEventLoad
  generation: number
  eventSource: IndexedSignetEventSource
}

const UNCONFIGURED: SignetEventStoreSnapshot = { status: 'unconfigured' }

function locationKey(location: SignetContractLocation): string {
  return JSON.stringify([location.indexerUrl, location.signetContractAddress])
}

/**
 * Holds the Signet contract's events per location, loading each location once through the SDK's
 * event stream. Only completed loads survive a change of location, so a load that stops matching
 * the current location is abandoned and its partial results are dropped.
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

  /** Makes `location` current and ensures it is loaded through `eventSource`. */
  select(location: SignetContractLocation, eventSource: IndexedSignetEventSource): void {
    const key = locationKey(location)
    this.#current = key
    this.#prune()
    const entry = this.#entries.get(key)
    if (
      entry === undefined ||
      (entry.load.status !== 'loaded' && entry.eventSource !== eventSource)
    ) {
      this.#start(key, location, eventSource)
    }
    this.#notify()
  }

  /** No current location: the snapshot is unconfigured. */
  deselect(): void {
    this.#current = null
    this.#prune()
    this.#notify()
  }

  /** Re-runs the backfill for the current location. No-op when unconfigured. */
  refresh(): void {
    if (this.#current === null) {
      return
    }
    const entry = this.#entries.get(this.#current)
    if (entry !== undefined) {
      this.#start(this.#current, entry.load.location, entry.eventSource)
      this.#notify()
    }
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
    location: SignetContractLocation,
    eventSource: IndexedSignetEventSource,
  ): void {
    const generation = ++this.#generation
    this.#entries.set(key, {
      load: { status: 'loading', location, events: [], tipId: null, lastId: null, error: null },
      generation,
      eventSource,
    })
    void this.#run(key, generation, location, eventSource)
  }

  #isLive(key: string, generation: number): boolean {
    return this.#entries.get(key)?.generation === generation
  }

  #commit(key: string, generation: number, load: SignetEventLoad): void {
    const entry = this.#entries.get(key)
    if (entry !== undefined && entry.generation === generation) {
      entry.load = load
      this.#notify()
    }
  }

  async #run(
    key: string,
    generation: number,
    location: SignetContractLocation,
    eventSource: IndexedSignetEventSource,
  ): Promise<void> {
    const events: SignetContractEvent[] = []
    let tipId: number | null = null
    let lastId: number | null = null
    const progress = (
      status: SignetEventLoadStatus,
      error: string | null = null,
    ): SignetEventLoad => ({ status, location, events: events.slice(), tipId, lastId, error })
    // The stream yields a whole page without touching the network, so a flush deferred to the
    // next macrotask publishes once per page rather than once per event.
    let flush: ReturnType<typeof setTimeout> | null = null
    const scheduleFlush = (): void => {
      flush ??= setTimeout(() => {
        flush = null
        this.#commit(key, generation, progress('loading'))
      }, 0)
    }
    try {
      for await (const event of eventSource.streamSignetEvents(location.signetContractAddress)) {
        if (!this.#isLive(key, generation)) {
          return
        }
        tipId ??= event.maxId
        lastId = event.id
        events.push(decodeSignetContractEvent(event))
        scheduleFlush()
      }
      this.#commit(key, generation, progress('loaded'))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.#commit(key, generation, progress('error', message))
    } finally {
      if (flush !== null) {
        clearTimeout(flush)
      }
    }
  }

  #notify(): void {
    for (const listener of this.#listeners) {
      listener()
    }
  }
}
