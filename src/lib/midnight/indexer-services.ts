import {
  type IndexedSignetMiscEvent,
  type SignetEventSource,
  signetEventSourceFromIndexer,
} from '@sig-net/midnight'

import type { MidnightNetworkConfig } from '@/lib/midnight/network'

export type MidnightIndexerUrls = Pick<MidnightNetworkConfig, 'indexerUrl'>

export interface MidnightIndexerServices {
  /** Streams the Signet contract's events from the indexer's query URL, one page at a time. */
  signetEventSource: SignetEventSource<IndexedSignetMiscEvent>
}

interface BuiltIndexerServices {
  urls: MidnightIndexerUrls
  services: MidnightIndexerServices
}

/**
 * Owns the indexer-backed services for one indexer URL. Consumers key their work on the identity
 * of a service, so the same URL always yields the same objects.
 */
export class MidnightIndexerServicesStore {
  #built: BuiltIndexerServices | null = null
  readonly #listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  getSnapshot = (): MidnightIndexerServices | null => this.#built?.services ?? null

  /** Builds services for `urls`, replacing the current ones only when the URL differs. */
  connect(urls: MidnightIndexerUrls): void {
    if (this.#built?.urls.indexerUrl === urls.indexerUrl) {
      return
    }
    this.#built = {
      urls,
      services: { signetEventSource: signetEventSourceFromIndexer({ queryUrl: urls.indexerUrl }) },
    }
    this.#notify()
  }

  disconnect(): void {
    if (this.#built !== null) {
      this.#built = null
      this.#notify()
    }
  }

  #notify(): void {
    for (const listener of this.#listeners) {
      listener()
    }
  }
}
