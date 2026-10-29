import { parseRequestIdHex, type RequestIdHex } from '@sig-net/midnight'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  type MidnightSignetEventsContextValue,
  useMidnightSignetEvents,
} from '@/components/contexts/MidnightSignetEventsContext'
import { useMidnight } from '@/components/contexts/MidnightContext'
import { SignBidirectionalLifecycleTable } from '@/components/midnight/sign-bidirectional-lifecycle-table'
import { SignetEventsStartingBlock } from '@/components/midnight/signet-events-starting-block'
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
    switch (events.startingBlock.status) {
      case 'resolving':
        return 'Reading the chain tip for the starting block'
      case 'unavailable':
        return `Could not read the chain tip for the starting block: ${events.startingBlock.error}`
      case 'invalid':
        return 'The starting block is not a block height'
      case 'resolved':
        return 'No valid Signet contract address configured'
      default: {
        const exhaustive: never = events.startingBlock
        throw new Error(`unhandled starting block ${String(exhaustive)}`)
      }
    }
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
      return `${counts}, reading back from block ${String(events.read.toBlock)}, at ${String(events.read.fromBlock)} of ${String(events.targetFromBlock)}`
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
  const { setConfig } = useMidnight()
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
  const { status, canStepStartingBlockBack, stepStartingBlockBack } = events
  // A linked request may be older than the window. Once the window is read without the request's
  // notification, the starting block steps back until the notification is found or the floor is
  // reached, so a link to any request resolves.
  const linkedRequestNotified =
    requestId === undefined ||
    lifecycles.some(
      (lifecycle) =>
        lifecycle.requestId === requestId && lifecycle.signBidirectionalEvents.length > 0,
    )
  useEffect(() => {
    if (status === 'loaded' && !linkedRequestNotified) {
      stepStartingBlockBack()
    }
  }, [status, linkedRequestNotified, stepStartingBlockBack])
  // The search for the linked request runs from the tip read until the window is read with no step
  // back left, or the load fails.
  const loading = events.startingBlock.status === 'resolving' || status === 'loading'
  const searchingLinkedRequest =
    !linkedRequestNotified && (loading || (status === 'loaded' && canStepStartingBlockBack))

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
        <SignetEventsStartingBlock
          startingBlock={events.startingBlock}
          canStepBack={canStepStartingBlockBack}
          onChange={(signetEventsFromBlock) => setConfig({ signetEventsFromBlock })}
          onStepBack={stepStartingBlockBack}
        />
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
        searching={searchingLinkedRequest}
        loading={loading}
        // Only a search singles a request out: while the page loads, the first request to arrive
        // is briefly the only row.
        expandSoleRow={search.trim() !== ''}
      />
    </div>
  )
}
