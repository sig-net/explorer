import {
  indexerPublicDataProvider,
  type IndexerPublicDataProvider,
} from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
import {
  type IndexedSignetMiscEvent,
  type SignetEventSource,
  signetEventSourceFromIndexer,
} from '@sig-net/midnight'

import type { MidnightNetworkConfig } from '@/lib/midnight/network'

export type MidnightIndexerUrls = Pick<MidnightNetworkConfig, 'indexerUrl' | 'indexerWsUrl'>

export interface MidnightIndexerServices {
  publicDataProvider: IndexerPublicDataProvider
  /** Streams the Signet contract's events from the indexer's query URL, one page at a time. */
  signetEventSource: SignetEventSource<IndexedSignetMiscEvent>
}

interface BuiltIndexerServices {
  urls: MidnightIndexerUrls
  services: MidnightIndexerServices
}

/**
 * Owns the indexer-backed services for one set of URLs. The provider holds a WebSocket connection,
 * so replacing or releasing the services disposes it.
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

  /** Builds services for `urls`, replacing the current ones only when either URL differs. */
  connect(urls: MidnightIndexerUrls): void {
    if (
      this.#built?.urls.indexerUrl === urls.indexerUrl &&
      this.#built.urls.indexerWsUrl === urls.indexerWsUrl
    ) {
      return
    }
    this.#release()
    const publicDataProvider = indexerPublicDataProvider({
      queryURL: urls.indexerUrl,
      subscriptionURL: urls.indexerWsUrl,
    })
    this.#built = {
      urls,
      services: {
        publicDataProvider,
        signetEventSource: signetEventSourceFromIndexer({ queryUrl: urls.indexerUrl }),
      },
    }
    this.#notify()
  }

  disconnect(): void {
    if (this.#built !== null) {
      this.#release()
      this.#notify()
    }
  }

  #release(): void {
    if (this.#built !== null) {
      void this.#built.services.publicDataProvider.dispose()
      this.#built = null
    }
  }

  #notify(): void {
    for (const listener of this.#listeners) {
      listener()
    }
  }
}
