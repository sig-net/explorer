import { parseRequestIdHex, type RequestIdHex } from '@sig-net/midnight'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { RefreshCw, X } from 'lucide-react'
import { useState } from 'react'

import {
  type MidnightSignetEventsContextValue,
  useMidnightSignetEvents,
} from '@/components/contexts/MidnightSignetEventsContext'
import { SignBidirectionalLifecycleTable } from '@/components/midnight/sign-bidirectional-lifecycle-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  type SignBidirectionalLifecycle,
  signBidirectionalLifecycleEventCount,
  signBidirectionalLifecycleMatches,
} from '@/lib/midnight/sign-bidirectional-lifecycle'

interface ExplorerSearch {
  /** The request a link points at. It seeds the search box, and editing the box drops it. */
  requestId?: RequestIdHex | undefined
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
  }),
  // Rewrites the URL when the raw `requestId` is not the validated one (invalid, or spelled with
  // `0x` or capitals), so the address bar and the state agree.
  beforeLoad: ({ search, location }) => {
    const query = new URLSearchParams(location.searchStr)
    if ((query.get('requestId') ?? undefined) !== search.requestId) {
      if (search.requestId === undefined) {
        query.delete('requestId')
      } else {
        query.set('requestId', search.requestId)
      }
      throw redirect({ href: `${location.pathname}?${query.toString()}`, replace: true })
    }
  },
  component: ExplorerPage,
})

/**
 * The load status, counting the search's matches out of everything loaded. The events total
 * includes events that joined no request, which no search matches.
 */
function loadStatusText(
  events: MidnightSignetEventsContextValue,
  matching: readonly SignBidirectionalLifecycle[],
): string {
  if (events.status === 'unconfigured') {
    return 'No valid Signet contract address configured'
  }
  const matchingEvents = matching.reduce(
    (count, lifecycle) => count + signBidirectionalLifecycleEventCount(lifecycle),
    0,
  )
  const counts =
    `${String(matchingEvents)}/${String(events.events.length)} events, ` +
    `${String(matching.length)}/${String(events.lifecycles.length)} requests`
  switch (events.status) {
    case 'loading':
      return `${counts}, loading (last id ${String(events.lastId ?? '-')} of tip ${String(events.tipId ?? '-')})`
    case 'loaded':
      return counts
    case 'error':
      return `${counts}, then: ${events.error}`
    default: {
      const exhaustive: never = events
      throw new Error(`unhandled status ${String(exhaustive)}`)
    }
  }
}

function ExplorerPage() {
  const events = useMidnightSignetEvents()
  const { requestId } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [search, setSearch] = useState<string>(requestId ?? '')
  // An edited box no longer shows the linked request, so the address bar stops naming it.
  const editSearch = (value: string) => {
    setSearch(value)
    if (requestId !== undefined) {
      void navigate({ search: ({ requestId: _dropped, ...rest }) => rest, replace: true })
    }
  }
  const lifecycles = events.status === 'unconfigured' ? [] : events.lifecycles
  const matching = lifecycles.filter((lifecycle) =>
    signBidirectionalLifecycleMatches(lifecycle, search),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-full max-w-xl items-center gap-2">
          <Input
            // The dark variant is spelled out so it beats the input's own `dark:bg-input/30`.
            className="bg-card dark:bg-card"
            aria-label="Search by request id or caller contract"
            placeholder="Search by request id or caller contract"
            value={search}
            onChange={(event) => editSearch(event.target.value)}
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Clear search"
            disabled={search === ''}
            onClick={() => editSearch('')}
          >
            <X />
          </Button>
        </div>
        <p className="text-muted-foreground ml-auto text-sm">{loadStatusText(events, matching)}</p>
        <Button
          variant="outline"
          size="icon"
          aria-label="Refresh"
          disabled={events.status === 'unconfigured'}
          onClick={events.refresh}
        >
          <RefreshCw />
        </Button>
      </div>
      <SignBidirectionalLifecycleTable
        lifecycles={matching}
        emptyText={lifecycles.length === 0 ? 'No requests yet' : 'No requests match the search'}
        // Only a search singles a request out: while the page loads, the first request to arrive
        // is briefly the only row.
        expandSoleRow={search.trim() !== ''}
      />
    </div>
  )
}
