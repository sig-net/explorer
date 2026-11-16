import type { ExplorerService } from '@sig-net/explorer-api'
import { type ReactNode, createContext, useContext } from 'react'

/** The explorer's backend, or null when no backend is configured. */
export type ExplorerApiContextValue = ExplorerService | null

const ExplorerApiContext = createContext<ExplorerApiContextValue | undefined>(undefined)

export function ExplorerApiProvider({
  service,
  children,
}: {
  service: ExplorerApiContextValue
  children: ReactNode
}) {
  return <ExplorerApiContext value={service}>{children}</ExplorerApiContext>
}

export function useExplorerApi(): ExplorerApiContextValue {
  const context = useContext(ExplorerApiContext)
  if (context === undefined) {
    throw new Error('useExplorerApi must be used within an ExplorerApiProvider')
  }
  return context
}
