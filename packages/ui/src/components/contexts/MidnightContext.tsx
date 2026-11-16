import type { ExplorerNetwork } from '@sig-net/explorer-api'
import type { MidnightNetwork } from '@sig-net/midnight'
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react'

import { useExplorerApi } from '@/components/contexts/ExplorerApiContext'
import {
  DEFAULT_MIDNIGHT_NETWORK,
  MIDNIGHT_NETWORK_DEFAULTS,
  type MidnightNetworkConfig,
} from '@/lib/midnight/network'

export interface MidnightContextValue {
  network: MidnightNetwork
  /** The network defaults with any in-memory overrides applied. */
  config: MidnightNetworkConfig
  /** True when no field of the selected network has been overridden. */
  isDefaultConfig: boolean
  /** The networks the explorer's backend serves, as of its latest answer. */
  servedNetworks: ServedNetworks
  /**
   * The selected network as the backend serves it: its server configuration and how far it is
   * indexed. Null until the backend has answered, and when it does not serve the network.
   */
  servedNetwork: ExplorerNetwork | null
  setNetwork: (network: MidnightNetwork) => void
  /** Overrides one or more fields of the selected network's configuration. */
  setConfig: (patch: Partial<MidnightNetworkConfig>) => void
  /** Drops every override for the selected network. */
  resetDefaults: () => void
  /** Asks the backend for its networks again, keeping the latest answer until the new one. */
  refreshServedNetworks: () => void
}

export type ServedNetworks =
  | { readonly status: 'no-backend' }
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly networks: readonly ExplorerNetwork[] }
  | { readonly status: 'error'; readonly error: string }

type ConfigOverrides = Partial<Record<MidnightNetwork, Partial<MidnightNetworkConfig>>>

const MidnightContext = createContext<MidnightContextValue | null>(null)

export function MidnightProvider({ children }: { children: ReactNode }) {
  const service = useExplorerApi()
  const [network, setNetwork] = useState<MidnightNetwork>(DEFAULT_MIDNIGHT_NETWORK)
  const [overrides, setOverrides] = useState<ConfigOverrides>({})
  const [networkReads, setNetworkReads] = useState(0)
  const [answer, setAnswer] = useState<ServedNetworks | null>(null)

  useEffect(() => {
    let current = true
    if (service !== null && networkReads >= 0) {
      service.networks().then(
        (networks) => {
          if (current) {
            setAnswer({ status: 'loaded', networks })
          }
        },
        (error: unknown) => {
          if (current) {
            setAnswer({
              status: 'error',
              error: error instanceof Error ? error.message : String(error),
            })
          }
        },
      )
    }
    return () => {
      current = false
    }
  }, [service, networkReads])

  const servedNetworks: ServedNetworks =
    service === null ? { status: 'no-backend' } : (answer ?? { status: 'loading' })
  const networkOverrides = overrides[network] ?? {}
  const config: MidnightNetworkConfig = {
    ...MIDNIGHT_NETWORK_DEFAULTS[network],
    ...networkOverrides,
  }

  const value: MidnightContextValue = {
    network,
    config,
    isDefaultConfig: Object.keys(networkOverrides).length === 0,
    servedNetworks,
    servedNetwork:
      servedNetworks.status === 'loaded'
        ? (servedNetworks.networks.find((served) => served.network === network) ?? null)
        : null,
    setNetwork,
    setConfig: (patch) => {
      setOverrides((previous) => ({
        ...previous,
        [network]: { ...previous[network], ...patch },
      }))
    },
    resetDefaults: () => {
      setOverrides((previous) => {
        const { [network]: _dropped, ...rest } = previous
        return rest
      })
    },
    refreshServedNetworks: () => setNetworkReads((reads) => reads + 1),
  }

  return <MidnightContext value={value}>{children}</MidnightContext>
}

export function useMidnight(): MidnightContextValue {
  const context = useContext(MidnightContext)
  if (context === null) {
    throw new Error('useMidnight must be used within a MidnightProvider')
  }
  return context
}

/** Whether the backend has answered and does not serve `network`. */
export function isUnservedNetwork(
  servedNetworks: ServedNetworks,
  network: MidnightNetwork,
): boolean {
  return (
    servedNetworks.status === 'loaded' &&
    !servedNetworks.networks.some((served) => served.network === network)
  )
}
