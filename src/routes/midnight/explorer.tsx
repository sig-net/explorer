import { createFileRoute } from '@tanstack/react-router'

import {
  type MidnightSignetEventsContextValue,
  useMidnightSignetEvents,
} from '@/components/contexts/MidnightSignetEventsContext'
import { SignBidirectionalLifecycleTable } from '@/components/midnight/sign-bidirectional-lifecycle-table'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/midnight/explorer')({
  component: ExplorerPage,
})

function loadStatusText(events: MidnightSignetEventsContextValue): string {
  switch (events.status) {
    case 'unconfigured':
      return 'No valid Signet contract address configured'
    case 'loading':
      return (
        `${String(events.events.length)} events loaded, loading ` +
        `(last id ${String(events.lastId ?? '-')} of tip ${String(events.tipId ?? '-')})`
      )
    case 'loaded':
      return `${String(events.events.length)} events in ${String(events.lifecycles.length)} requests`
    case 'error':
      return `${String(events.events.length)} events loaded, then: ${events.error}`
    default: {
      const exhaustive: never = events
      throw new Error(`unhandled status ${String(exhaustive)}`)
    }
  }
}

function ExplorerPage() {
  const events = useMidnightSignetEvents()
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <SignBidirectionalLifecycleTable
        lifecycles={events.status === 'unconfigured' ? [] : events.lifecycles}
      />
      <div className="text-muted-foreground flex items-center justify-between gap-2 text-sm">
        <p>{loadStatusText(events)}</p>
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
