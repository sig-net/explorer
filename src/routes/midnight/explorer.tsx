import { createFileRoute } from '@tanstack/react-router'

import { useMidnight } from '@/components/contexts/MidnightContext'
import {
  type MidnightSignetEventsContextValue,
  useMidnightSignetEvents,
} from '@/components/contexts/MidnightSignetEventsContext'
import { Button } from '@/components/ui/button'
import type { SignetContractEvent } from '@/lib/midnight/signet-events'

export const Route = createFileRoute('/midnight/explorer')({
  component: ExplorerPage,
})

function loadedText(events: readonly SignetContractEvent[]): string {
  const counts = new Map<string, number>()
  for (const event of events) {
    const label = event.kind === 'decoded' ? event.name : event.kind
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const breakdown = Array.from(counts, ([label, count]) => `${String(count)} ${label}`).join(', ')
  return `${String(events.length)} loaded${breakdown === '' ? '' : ` (${breakdown})`}`
}

function latestEventText(events: readonly SignetContractEvent[]): string | null {
  const latest = events.at(-1)
  if (latest === undefined) {
    return null
  }
  const { blockHeight, blockTimestamp, transactionHash } = latest.source
  return (
    `Latest event: block ${String(blockHeight)} at ${blockTimestamp.toISOString()}, ` +
    `transaction ${transactionHash}`
  )
}

function signetEventsStatusText(events: MidnightSignetEventsContextValue): string {
  switch (events.status) {
    case 'unconfigured':
      return 'Signet events: no valid Signet contract address configured'
    case 'loading':
      return (
        `Signet events: ${loadedText(events.events)}, loading ` +
        `(last id ${String(events.lastId ?? '-')} of tip ${String(events.tipId ?? '-')})`
      )
    case 'loaded':
      return `Signet events: ${loadedText(events.events)}`
    case 'error':
      return `Signet events: ${loadedText(events.events)}, then: ${events.error}`
    default: {
      const exhaustive: never = events
      throw new Error(`unhandled status ${String(exhaustive)}`)
    }
  }
}

function ExplorerPage() {
  const { network } = useMidnight()
  const events = useMidnightSignetEvents()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold">Explorer</h1>
      <p className="text-muted-foreground">Midnight {network}</p>
      <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
        <p>{signetEventsStatusText(events)}</p>
        {events.status !== 'unconfigured' && <p>{latestEventText(events.events)}</p>}
        <Button
          variant="outline"
          size="sm"
          disabled={events.status === 'unconfigured'}
          onClick={events.refresh}
        >
          Refresh
        </Button>
      </div>
    </div>
  )
}
