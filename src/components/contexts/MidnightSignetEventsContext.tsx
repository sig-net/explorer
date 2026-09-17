import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'

import { useMidnight } from '@/components/contexts/MidnightContext'
import { parseSignetContractAddress } from '@/lib/midnight/network'
import { SignetEventStore, type SignetEventStoreSnapshot } from '@/lib/midnight/signet-event-store'

export type MidnightSignetEventsContextValue = SignetEventStoreSnapshot & {
  /** Re-runs the backfill for the current location. No-op while unconfigured. */
  refresh: () => void
}

const MidnightSignetEventsContext = createContext<MidnightSignetEventsContextValue | null>(null)

/**
 * Loads the Signet contract's events once the indexer services exist and the selected network
 * names a contract address, and keeps every completed load for the life of the application.
 */
export function MidnightSignetEventsProvider({ children }: { children: ReactNode }) {
  const { indexerServices, config } = useMidnight()
  const { indexerUrl } = config
  // The configuration holds the address as typed. The canonical form keys the cache, so a `0x`
  // prefix or upper case names the same contract, and a half-typed address starts no load.
  const signetContractAddress = parseSignetContractAddress(config.signetContractAddress)
  const eventSource = indexerServices?.signetEventSource ?? null
  const [store] = useState(() => new SignetEventStore())

  // The store holds no connection of its own (MidnightProvider owns and disposes the provider),
  // so the effect needs no cleanup: a repeated run with the same location and event source keeps the
  // in-flight load.
  useEffect(() => {
    if (eventSource === null || signetContractAddress === null) {
      store.deselect()
    } else {
      store.select({ indexerUrl, signetContractAddress }, eventSource)
    }
  }, [store, eventSource, indexerUrl, signetContractAddress])

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)

  const value: MidnightSignetEventsContextValue = {
    ...snapshot,
    refresh: () => store.refresh(),
  }

  return <MidnightSignetEventsContext value={value}>{children}</MidnightSignetEventsContext>
}

export function useMidnightSignetEvents(): MidnightSignetEventsContextValue {
  const context = useContext(MidnightSignetEventsContext)
  if (context === null) {
    throw new Error('useMidnightSignetEvents must be used within a MidnightSignetEventsProvider')
  }
  return context
}
