import type { IndexedSignetMiscEvent } from '@sig-net/midnight'
import type { ReactNode } from 'react'

import { CopyButton } from '@/components/copy-button'
import { CopyableHex } from '@/components/copyable-hex'
import { DetailLine, DetailList } from '@/components/detail-list'
import { PendingIcon } from '@/components/pending-icon'
import { ScrollableTabsList } from '@/components/scrollable-tabs-list'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs'
import { formatLocalTimestamp } from '@/lib/format'

/**
 * The events of one kind, one tab per event in the order given: where on chain the event was
 * emitted, then whatever `renderRecord` makes of it. An empty `events` shows as pending.
 */
export function SignetEventsSection<TEvent extends { readonly source: IndexedSignetMiscEvent }>({
  heading,
  events,
  renderRecord,
}: {
  heading: string
  events: readonly TEvent[]
  renderRecord: (event: TEvent) => ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2 p-3">
      <h3 className="font-bold">{heading}</h3>
      {events.length === 0 ? (
        <PendingIcon />
      ) : (
        <Tabs defaultValue={events[0]?.source.id}>
          <ScrollableTabsList aria-label={heading}>
            {events.map(({ source }, index) => (
              <TabsTrigger key={source.id} value={source.id} className="min-w-10 flex-none">
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
