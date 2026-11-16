import {
  ExplorerApiError,
  LIFECYCLES_MIN_SEARCH_LENGTH,
  resolveLifecyclesQuery,
} from '@sig-net/explorer-api'
import { parseRequestIdHex, type RequestIdHex } from '@sig-net/midnight'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { CircleAlert, RefreshCw, Unplug, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useExplorerApi } from '@/components/contexts/ExplorerApiContext'
import { isUnservedNetwork, useMidnight } from '@/components/contexts/MidnightContext'
import {
  type MidnightLifecyclesContextValue,
  useMidnightLifecycles,
} from '@/components/contexts/MidnightLifecyclesContext'
import { ExcludedCallersFilter } from '@/components/midnight/excluded-callers-filter'
import { NetworkSyncAlert, NetworkSyncStatus } from '@/components/midnight/network-sync-status'
import { SignBidirectionalLifecycleTable } from '@/components/midnight/sign-bidirectional-lifecycle-table'
import { useLinkedLifecycle } from '@/components/midnight/use-linked-lifecycle'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseContractAddressesHex } from '@sig-net/explorer-lib'

interface ExplorerSearch {
  /** The request a link points at, shown alone. It fills the search box, and editing the box drops it. */
  requestId?: RequestIdHex | undefined
  /**
   * The excluded callers, as a comma-separated list of canonical contract addresses. The filter
   * panel reads them from here and writes every change back, so a link carries the filter.
   */
  excludeCallers?: string | undefined
}

/** An `excludeCallers` query value as the canonical list, or undefined when it names no address. */
function parseExcludeCallersParam(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const callers = parseContractAddressesHex(value)
  return callers.length === 0 ? undefined : callers.join(',')
}

/** A `requestId` query value as a request id, or undefined when it is not one. */
function parseRequestIdParam(value: unknown): RequestIdHex | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  try {
    return parseRequestIdHex(value)
  } catch {
    return undefined
  }
}

export const Route = createFileRoute('/midnight/explorer')({
  // The key is always returned: the raw query reaches this route from its parents, so an omitted
  // key would let an invalid value through.
  validateSearch: (search: Record<string, unknown>): ExplorerSearch => ({
    requestId: parseRequestIdParam(search.requestId),
    excludeCallers: parseExcludeCallersParam(search.excludeCallers),
  }),
  // Rewrites the URL when a raw value is not the validated one (invalid, or spelled with `0x`,
  // capitals or spaces), so the address bar and the state agree.
  beforeLoad: ({ search, location }) => {
    const query = new URLSearchParams(location.searchStr)
    let differs = false
    for (const [key, value] of Object.entries(search)) {
      if ((query.get(key) ?? undefined) === value) {
        continue
      }
      differs = true
      if (value === undefined) {
        query.delete(key)
      } else {
        query.set(key, value)
      }
    }
    if (differs) {
      // The router writes a list's commas unencoded, and this href must match what it writes.
      const href = `${location.pathname}?${query.toString().replaceAll('%2C', ',')}`
      throw redirect({ href, replace: true })
    }
  },
  component: ExplorerPage,
})

/** The counts of the newest answer, then how the latest read went. */
function loadStatusText(lifecycles: MidnightLifecyclesContextValue): string {
  const { counts, status } = lifecycles
  if (counts === null) {
    return status === 'loading' ? 'Loading' : ''
  }
  const text =
    `${String(counts.matchingEvents)}/${String(counts.totalEvents)} events, ` +
    `${String(counts.matchingRequests)}/${String(counts.totalRequests)} requests`
  return status === 'loading' ? `${text}, loading` : text
}

/** Whether `search` is typed but too short to search by, so it matches every lifecycle. */
function isShortSearch(search: string): boolean {
  if (search.trim() === '') {
    return false
  }
  try {
    return resolveLifecyclesQuery({ search }).fragment === ''
  } catch (error) {
    // A search the query refuses is no short search: the service answers it with its error.
    if (error instanceof ExplorerApiError) {
      return false
    }
    throw error
  }
}

/** Why nothing is listed while the build names no explorer backend, and how to name one. */
function NoBackendAlert() {
  return (
    <Alert>
      <Unplug />
      <AlertTitle>No explorer backend configured</AlertTitle>
      <AlertDescription>
        <p>
          The explorer lists requests from its backend. Build or start it with{' '}
          <code>VITE_EXPLORER_API_URL</code> set to the http or https URL of the explorer API.
        </p>
      </AlertDescription>
    </Alert>
  )
}

/** Why nothing is listed for a network the backend does not serve. */
function UnservedNetworkAlert({ network }: { network: string }) {
  return (
    <Alert>
      <Unplug />
      <AlertTitle>This backend does not index {network}</AlertTitle>
      <AlertDescription>
        <p>Select a network it serves.</p>
      </AlertDescription>
    </Alert>
  )
}

function ExplorerPage() {
  const service = useExplorerApi()
  const { network, servedNetworks } = useMidnight()
  if (service === null) {
    return <NoBackendAlert />
  }
  if (isUnservedNetwork(servedNetworks, network)) {
    return <UnservedNetworkAlert network={network} />
  }
  return <ExplorerList />
}

function ExplorerList() {
  const service = useExplorerApi()
  const lifecycles = useMidnightLifecycles()
  const { network, servedNetworks, servedNetwork, refreshServedNetworks } = useMidnight()
  const { requestId, excludeCallers } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [linkedReads, setLinkedReads] = useState(0)
  const linked = useLinkedLifecycle(service, network, requestId, linkedReads)
  const { search, setSearch, setExcludeCallers } = lifecycles
  // An edited box no longer shows the linked request, so the address bar stops naming it.
  const editSearch = (value: string) => {
    setSearch(value)
    if (requestId !== undefined) {
      void navigate({ search: ({ requestId: _dropped, ...rest }) => rest, replace: true })
    }
  }
  // The address bar holds the excluded callers, so the filter is read from it and written to it.
  const excludedCallers: readonly string[] =
    excludeCallers === undefined ? [] : excludeCallers.split(',')
  useEffect(() => {
    setExcludeCallers(excludeCallers === undefined ? [] : excludeCallers.split(','))
  }, [excludeCallers, setExcludeCallers])
  const setExcludedCallers = (next: readonly string[]) => {
    void navigate({
      search: ({ excludeCallers: _previous, ...rest }) =>
        next.length === 0 ? rest : { ...rest, excludeCallers: next.join(',') },
      replace: true,
    })
  }
  const excludeCaller = (caller: string) => {
    if (!excludedCallers.includes(caller)) {
      setExcludedCallers([...excludedCallers, caller])
    }
  }
  const restoreCaller = (caller: string) => {
    setExcludedCallers(excludedCallers.filter((other) => other !== caller))
  }
  const refresh = () => {
    lifecycles.refresh()
    refreshServedNetworks()
    setLinkedReads((reads) => reads + 1)
  }
  const boxValue = requestId ?? search
  const filterPanel = (
    <ExcludedCallersFilter
      callers={lifecycles.callers}
      excluded={excludedCallers}
      onExclude={excludeCaller}
      onRestore={restoreCaller}
    />
  )
  const error =
    linked?.status === 'error'
      ? linked.error
      : lifecycles.status === 'error'
        ? lifecycles.error
        : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex w-full max-w-xl flex-col gap-1">
          <div className="flex items-center gap-2">
            <Input
              // The dark variant is spelled out so it beats the input's own `dark:bg-input/30`.
              className="bg-card dark:bg-card"
              aria-label="Search by request id or caller contract"
              placeholder="Search by request id or caller contract"
              value={boxValue}
              onChange={(event) => editSearch(event.target.value)}
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Clear search"
              disabled={boxValue === ''}
              onClick={() => editSearch('')}
            >
              <X />
            </Button>
          </div>
          {requestId === undefined && isShortSearch(search) && (
            <p className="text-muted-foreground text-sm">
              Type at least {LIFECYCLES_MIN_SEARCH_LENGTH} characters to search
            </p>
          )}
        </div>
        <div className="ml-auto flex flex-col items-end self-center">
          <p className="text-muted-foreground text-sm">{loadStatusText(lifecycles)}</p>
          {servedNetwork !== null && <NetworkSyncStatus served={servedNetwork} />}
        </div>
        <Button variant="outline" size="icon" aria-label="Refresh" onClick={refresh}>
          <RefreshCw />
        </Button>
      </div>
      {servedNetwork !== null && <NetworkSyncAlert served={servedNetwork} />}
      {servedNetworks.status === 'error' && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>The explorer backend could not list its networks</AlertTitle>
          <AlertDescription>
            <p>{servedNetworks.error}</p>
          </AlertDescription>
        </Alert>
      )}
      {error !== null && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>The explorer backend could not answer</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
          </AlertDescription>
        </Alert>
      )}
      {linked === null ? (
        <SignBidirectionalLifecycleTable
          lifecycles={lifecycles.lifecycles}
          emptyText={
            lifecycles.counts?.totalRequests === 0
              ? 'No requests yet'
              : excludedCallers.length === 0
                ? 'No requests match the search'
                : 'No requests match the search and filters'
          }
          loading={lifecycles.status === 'loading'}
          filterPanel={filterPanel}
          activeFilterCount={excludedCallers.length}
          onExcludeCaller={excludeCaller}
          onLoadMore={lifecycles.hasMore ? lifecycles.loadMore : null}
          // Only a search singles a request out: while the page loads, the first request to arrive
          // is briefly the only row.
          expandSoleRow={search.trim() !== ''}
        />
      ) : (
        <SignBidirectionalLifecycleTable
          lifecycles={linked.status === 'found' ? [linked.lifecycle] : []}
          emptyText="Request not found"
          loading={linked.status === 'loading'}
          filterPanel={filterPanel}
          activeFilterCount={excludedCallers.length}
          onExcludeCaller={excludeCaller}
          onLoadMore={null}
          expandSoleRow
        />
      )}
    </div>
  )
}
