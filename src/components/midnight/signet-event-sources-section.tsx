import type { IndexedSignetMiscEvent } from '@sig-net/midnight'
import type { ReactNode } from 'react'

import { CopyableHex } from '@/components/copyable-hex'
import { PendingIcon } from '@/components/pending-icon'
import { ScrollableTabsList } from '@/components/scrollable-tabs-list'
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs'
import { formatUtcTimestamp } from '@/lib/format'

function DetailLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-bold">{label}:</dt>
      <dd>{children}</dd>
    </>
  )
}

/**
 * Where on chain each event of one kind was emitted, one tab per event in the order given. An
 * empty `sources` shows as pending.
 */
export function SignetEventSourcesSection({
  heading,
  sources,
}: {
  heading: string
  sources: readonly IndexedSignetMiscEvent[]
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2 p-3">
      <h3 className="font-bold">{heading}</h3>
      {sources.length === 0 ? (
        <PendingIcon />
      ) : (
        <Tabs defaultValue={sources[0]?.id}>
          <ScrollableTabsList aria-label={heading}>
            {sources.map((source, index) => (
              <TabsTrigger key={source.id} value={source.id} className="min-w-10 flex-none">
                {index + 1}
              </TabsTrigger>
            ))}
          </ScrollableTabsList>
          {sources.map((source) => (
            <TabsContent key={source.id} value={source.id}>
              <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1">
                <DetailLine label="Txn Hash">
                  <CopyableHex value={source.transactionHash} label="transaction hash" />
                </DetailLine>
                <DetailLine label="Block Hash">
                  <CopyableHex value={source.blockHash} label="block hash" />
                </DetailLine>
                <DetailLine label="Timestamp">
                  <span className="tabular-nums">{formatUtcTimestamp(source.blockTimestamp)}</span>
                </DetailLine>
              </dl>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </section>
  )
}
