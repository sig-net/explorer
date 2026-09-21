import type { IndexedSignetMiscEvent } from '@sig-net/midnight'
import { cn } from 'cn'
import { type ReactNode, useState } from 'react'

import { CopyButton } from '@/components/copy-button'
import { CopyableHex } from '@/components/copyable-hex'
import { DetailLine, DetailList } from '@/components/detail-list'
import { PendingIcon } from '@/components/pending-icon'
import { ScrollableTabsList } from '@/components/scrollable-tabs-list'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs'
import { formatLocalTimestamp } from '@/lib/format'

const SUCCESSFUL_TAB_CLASS_NAME =
  'bg-success-500/15 text-success-700 hover:text-success-700 data-active:border-success-500/50 data-active:bg-success-500/25 data-active:text-success-700 dark:text-success-400 dark:hover:text-success-400 dark:data-active:border-success-500/50 dark:data-active:bg-success-500/25 dark:data-active:text-success-400'

/**
 * The events of one kind, one tab per event in the order given: where on chain the event was
 * emitted, then whatever `renderRecord` makes of it. An empty `events` shows as pending.
 *
 * The tabs of the events in `successfulEventIds`, by source id, are green. Until a tab is picked by
 * hand, the first of them is the selected one, and the first event while there is none.
 */
export function SignetEventsSection<TEvent extends { readonly source: IndexedSignetMiscEvent }>({
  heading,
  events,
  renderRecord,
  successfulEventIds,
}: {
  heading: string
  events: readonly TEvent[]
  renderRecord: (event: TEvent) => ReactNode
  successfulEventIds?: ReadonlySet<number>
}) {
  const [pickedEventId, setPickedEventId] = useState<number | null>(null)
  const firstSuccessfulEvent = events.find(({ source }) => successfulEventIds?.has(source.id))
  const selectedEventId = pickedEventId ?? (firstSuccessfulEvent ?? events[0])?.source.id
  return (
    <section className="flex min-w-0 flex-col gap-2 p-3">
      <h3 className="font-bold">{heading}</h3>
      {events.length === 0 ? (
        <PendingIcon />
      ) : (
        <Tabs
          value={selectedEventId}
          // Base UI types a tab value as `any`. Every tab here takes a source id, a number.
          onValueChange={(value: unknown) => {
            if (typeof value === 'number') {
              setPickedEventId(value)
            }
          }}
        >
          <ScrollableTabsList aria-label={heading}>
            {events.map(({ source }, index) => (
              <TabsTrigger
                key={source.id}
                value={source.id}
                data-successful={successfulEventIds?.has(source.id) ? '' : undefined}
                className={cn(
                  'min-w-10 flex-none',
                  successfulEventIds?.has(source.id) && SUCCESSFUL_TAB_CLASS_NAME,
                )}
              >
                {index + 1}
              </TabsTrigger>
            ))}
          </ScrollableTabsList>
          {events.map((event) => (
            <TabsContent
              key={event.source.id}
              value={event.source.id}
              className="flex flex-col gap-3"
            >
              <DetailList>
                <DetailLine label="Txn Hash">
                  <CopyableHex value={event.source.transactionHash} label="transaction hash" />
                </DetailLine>
                <DetailLine label="Block Hash">
                  <CopyableHex value={event.source.blockHash} label="block hash" />
                </DetailLine>
                <DetailLine label="Block Height">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    {event.source.blockHeight}
                    <CopyButton value={String(event.source.blockHeight)} label="block height" />
                  </span>
                </DetailLine>
                <DetailLine label="Timestamp">
                  <span className="tabular-nums">
                    {formatLocalTimestamp(event.source.blockTimestamp)}
                  </span>
                </DetailLine>
              </DetailList>
              <Separator />
              {renderRecord(event)}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </section>
  )
}
