import { type ReactNode, createContext, useContext, useState } from 'react'
import type { MidnightNetwork } from '@sig-net/midnight'

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
  setNetwork: (network: MidnightNetwork) => void
  /** Overrides one or more fields of the selected network's configuration. */
  setConfig: (patch: Partial<MidnightNetworkConfig>) => void
  /** Drops every override for the selected network. */
  resetDefaults: () => void
}

type ConfigOverrides = Partial<Record<MidnightNetwork, Partial<MidnightNetworkConfig>>>

const MidnightContext = createContext<MidnightContextValue | null>(null)

export function MidnightProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState<MidnightNetwork>(DEFAULT_MIDNIGHT_NETWORK)
  const [overrides, setOverrides] = useState<ConfigOverrides>({})

  const networkOverrides = overrides[network] ?? {}
  const config: MidnightNetworkConfig = {
    ...MIDNIGHT_NETWORK_DEFAULTS[network],
    ...networkOverrides,
  }

  const value: MidnightContextValue = {
    network,
    config,
    isDefaultConfig: Object.keys(networkOverrides).length === 0,
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
