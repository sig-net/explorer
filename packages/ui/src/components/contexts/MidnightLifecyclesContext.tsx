import type { InspectedSignBidirectionalLifecycle, LifecyclePage } from '@sig-net/explorer-api'
import type { MidnightNetwork } from '@sig-net/midnight'
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useExplorerApi } from '@/components/contexts/ExplorerApiContext'
import { useMidnight } from '@/components/contexts/MidnightContext'

export interface MidnightLifecyclesContextValue {
  /** The search as typed. The pages follow it once it has rested for 300 ms. */
  readonly search: string
  readonly setSearch: (search: string) => void
  readonly excludeCallers: readonly string[]
  readonly setExcludeCallers: (callers: readonly string[]) => void
  /** Every page loaded for the current query, newest first. */
  readonly lifecycles: readonly InspectedSignBidirectionalLifecycle[]
  /** The counts of the newest answer, or null before the query's first answer. */
  readonly counts: MidnightLifecycleCounts | null
  /** True while an older page is left to load. */
  readonly hasMore: boolean
  readonly status: MidnightLifecyclesStatus
  /** Why the latest read failed, while `status` is `error`. */
  readonly error: string | null
  /** The callers of the selected network, for the exclusion filter to offer. */
  readonly callers: readonly string[]
  /** Appends the next older page. Does nothing while a read is under way or no page is left. */
  readonly loadMore: () => void
  /** Reads the first page and the callers again, keeping what is shown until the answer. */
  readonly refresh: () => void
}

export type MidnightLifecyclesStatus = 'loading' | 'loaded' | 'error'

export type MidnightLifecycleCounts = Pick<
  LifecyclePage,
  'matchingEvents' | 'totalEvents' | 'matchingRequests' | 'totalRequests'
>

const MidnightLifecyclesContext = createContext<MidnightLifecyclesContextValue | null>(null)

const SEARCH_DEBOUNCE_MS = 300

/**
 * Pages the selected network's lifecycles from the explorer's backend for the current search and
 * excluded callers, and keeps them for the life of the application. Reads nothing while no backend
 * is configured.
 */
export function MidnightLifecyclesProvider({ children }: { children: ReactNode }) {
  const service = useExplorerApi()
  const { network } = useMidnight()
  const [search, setSearch] = useState('')
  const [settledSearch, setSettledSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])
  const [excludeCallers, setExcludeCallersState] = useState<readonly string[]>([])
  const setExcludeCallers = useCallback((next: readonly string[]) => {
    setExcludeCallersState((current) => (current.join(',') === next.join(',') ? current : next))
  }, [])
  const query = useMemo(
    (): LifecyclesQueryKey => ({ network, search: settledSearch, excludeCallers }),
    [network, settledSearch, excludeCallers],
  )

  const [refreshes, setRefreshes] = useState(0)
  const [load, setLoad] = useState<LifecyclesLoad | null>(null)
  useEffect(() => {
    let current = true
    if (service !== null) {
      service
        .lifecycles(query.network, { search: query.search, excludeCallers: query.excludeCallers })
        .then(
          (page) => {
            if (current) {
              setLoad({
                ...answeredPage(page),
                query,
                refresh: refreshes,
                lifecycles: page.lifecycles,
              })
            }
          },
          (error: unknown) => {
            if (current) {
              // A failed refresh keeps the pages of the same query.
              setLoad((previous) => ({
                ...(previous?.query === query ? previous : emptyLoad(query)),
                refresh: refreshes,
                loadingMore: false,
                error: errorMessage(error),
              }))
            }
          },
        )
    }
    return () => {
      current = false
    }
  }, [service, query, refreshes])

  const [callers, setCallers] = useState<NetworkCallers | null>(null)
  useEffect(() => {
    let current = true
    if (service !== null) {
      // The filter accepts a typed address without the list, so a failed read leaves it empty.
      service.callers(network).then(
        (list) => {
          if (current) {
            setCallers({ network, refresh: refreshes, callers: list })
          }
        },
        () => {
          if (current) {
            setCallers({ network, refresh: refreshes, callers: [] })
          }
        },
      )
    }
    return () => {
      current = false
    }
  }, [service, network, refreshes])

  // The pages shown belong to the current query, and they are settled once its newest read is in.
  const shown = load?.query === query ? load : null
  const settled = shown !== null && shown.refresh === refreshes && !shown.loadingMore
  const status: MidnightLifecyclesStatus = !settled
    ? 'loading'
    : shown.error === null
      ? 'loaded'
      : 'error'

  const loadMore = (): void => {
    if (service === null || !settled || shown.nextBefore === null) {
      return
    }
    const from = shown
    const before = shown.nextBefore
    setLoad({ ...from, loadingMore: true, error: null })
    // An answer lands only on the pages it continues: not after a new query or a refresh.
    const continues = (previous: LifecyclesLoad | null): previous is LifecyclesLoad =>
      previous !== null &&
      previous.query === from.query &&
      previous.refresh === from.refresh &&
      previous.loadingMore
    service
      .lifecycles(from.query.network, {
        search: from.query.search,
        excludeCallers: from.query.excludeCallers,
        before,
      })
      .then(
        (page) => {
          setLoad((previous) =>
            continues(previous)
              ? {
                  ...previous,
                  ...answeredPage(page),
                  lifecycles: [...previous.lifecycles, ...page.lifecycles],
                }
              : previous,
          )
        },
        (error: unknown) => {
          setLoad((previous) =>
            continues(previous)
              ? { ...previous, loadingMore: false, error: errorMessage(error) }
              : previous,
          )
        },
      )
  }

  const value: MidnightLifecyclesContextValue = {
    search,
    setSearch,
    excludeCallers,
    setExcludeCallers,
    lifecycles: shown?.lifecycles ?? [],
    counts: shown?.counts ?? null,
    hasMore: shown !== null && shown.nextBefore !== null,
    status,
    error: status === 'error' ? (shown?.error ?? null) : null,
    callers: callers?.network === network ? callers.callers : [],
    loadMore,
    refresh: () => setRefreshes((count) => count + 1),
  }

  return <MidnightLifecyclesContext value={value}>{children}</MidnightLifecyclesContext>
}

export function useMidnightLifecycles(): MidnightLifecyclesContextValue {
  const context = useContext(MidnightLifecyclesContext)
  if (context === null) {
    throw new Error('useMidnightLifecycles must be used within a MidnightLifecyclesProvider')
  }
  return context
}

/** What the pages are read for. A new object is a new query, whose pages start again. */
interface LifecyclesQueryKey {
  readonly network: MidnightNetwork
  readonly search: string
  readonly excludeCallers: readonly string[]
}

/** The pages read for one query, as of the read of the first page that answered last. */
interface LifecyclesLoad {
  readonly query: LifecyclesQueryKey
  /** The count of refreshes when the first page was read. */
  readonly refresh: number
  readonly lifecycles: readonly InspectedSignBidirectionalLifecycle[]
  readonly counts: MidnightLifecycleCounts | null
  readonly nextBefore: number | null
  /** True while an older page is being read. */
  readonly loadingMore: boolean
  /** Why the latest read failed, or null when it succeeded. */
  readonly error: string | null
}

interface NetworkCallers {
  readonly network: MidnightNetwork
  /** The count of refreshes when the list was read. */
  readonly refresh: number
  readonly callers: readonly string[]
}

function emptyLoad(query: LifecyclesQueryKey): LifecyclesLoad {
  return {
    query,
    refresh: 0,
    lifecycles: [],
    counts: null,
    nextBefore: null,
    loadingMore: false,
    error: null,
  }
}

/** What an answered page sets on the pages it joins, beside its lifecycles. */
function answeredPage(
  page: LifecyclePage,
): Pick<LifecyclesLoad, 'counts' | 'nextBefore' | 'loadingMore' | 'error'> {
  const { matchingEvents, totalEvents, matchingRequests, totalRequests } = page
  return {
    counts: { matchingEvents, totalEvents, matchingRequests, totalRequests },
    nextBefore: page.nextBefore,
    loadingMore: false,
    error: null,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
