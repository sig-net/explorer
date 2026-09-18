import { ChevronDown, ChevronUp } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

import { CopyableHex } from '@/components/copyable-hex'
import {
  RespondBidirectionalEventDetails,
  SignatureRespondedEventDetails,
  SignBidirectionalNotificationDetails,
} from '@/components/midnight/signet-event-record-details'
import { SignBidirectionalTransactionDetails } from '@/components/midnight/sign-bidirectional-transaction-details'
import { SignetEventsSection } from '@/components/midnight/signet-events-section'
import { PendingIcon } from '@/components/pending-icon'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDuration, formatLocalTimestamp } from '@/lib/format'
import {
  type SignBidirectionalLifecycle,
  signBidirectionalLifecycleDurationMs,
} from '@/lib/midnight/sign-bidirectional-lifecycle'

/** Entries shown in one cell before the rest collapse into an ellipsis. */
const MAX_STACKED = 3

function Stacked({ children }: { children: readonly ReactNode[] }) {
  return (
    <div className="flex flex-col gap-1">
      {children.slice(0, MAX_STACKED)}
      {children.length > MAX_STACKED && (
        <span aria-label={`${String(children.length - MAX_STACKED)} more`}>...</span>
      )}
    </div>
  )
}

function Timestamps({ dates }: { dates: readonly Date[] }) {
  return (
    <Stacked>
      {dates.map((date, index) => (
        <span key={index} className="tabular-nums">
          {formatLocalTimestamp(date)}
        </span>
      ))}
    </Stacked>
  )
}

function LifecycleRow({ lifecycle }: { lifecycle: SignBidirectionalLifecycle }) {
  const { signBidirectionalEvents, signatureRespondedEvents, respondBidirectionalEvents } =
    lifecycle
  const durationMs = signBidirectionalLifecycleDurationMs(lifecycle)
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  return (
    <>
      <TableRow className="[&>td]:align-top">
        <TableCell>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={expanded ? 'Collapse event details' : 'Expand event details'}
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </TableCell>
        <TableCell>
          <Timestamps dates={signBidirectionalEvents.map((event) => event.source.blockTimestamp)} />
        </TableCell>
        <TableCell>
          <CopyableHex value={lifecycle.requestId} label="request id" />
        </TableCell>
        <TableCell>
          <Stacked>
            {signBidirectionalEvents.map((event) => (
              <CopyableHex
                key={event.source.id}
                value={event.record.callerAddress}
                label="caller address"
              />
            ))}
          </Stacked>
        </TableCell>
        <TableCell>Bidirectional</TableCell>
        <TableCell>
          {signatureRespondedEvents.length === 0 ? (
            <PendingIcon />
          ) : (
            <Timestamps
              dates={signatureRespondedEvents.map((event) => event.source.blockTimestamp)}
            />
          )}
        </TableCell>
        <TableCell>
          {respondBidirectionalEvents.length === 0 ? (
            <PendingIcon />
          ) : (
            <Timestamps
              dates={respondBidirectionalEvents.map((event) => event.source.blockTimestamp)}
            />
          )}
        </TableCell>
        <TableCell>{durationMs === null ? <PendingIcon /> : formatDuration(durationMs)}</TableCell>
      </TableRow>
      {expanded && (
        <TableRow id={detailsId} className="hover:bg-transparent">
          <TableCell colSpan={COLUMN_COUNT} className="p-0 whitespace-normal">
            <div className="grid grid-cols-3 divide-x">
              <SignetEventsSection
                heading="Sign Bidirectional Notification"
                events={signBidirectionalEvents}
                renderRecord={(event) => (
                  <>
                    <SignBidirectionalNotificationDetails record={event.record} />
                    <Separator />
                    <SignBidirectionalTransactionDetails event={event} />
                  </>
                )}
              />
              <SignetEventsSection
                heading="Signature Responded Event"
                events={signatureRespondedEvents}
                renderRecord={(event) => <SignatureRespondedEventDetails record={event.record} />}
              />
              <SignetEventsSection
                heading="Respond Bidirectional Event"
                events={respondBidirectionalEvents}
                renderRecord={(event) => <RespondBidirectionalEventDetails record={event.record} />}
              />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

const COLUMNS = [
  'Requested at',
  'Request Id',
  'Caller',
  'Type',
  'Signature',
  'Response',
  'Duration',
] as const

/** The named columns and the leading expand control's column. */
const COLUMN_COUNT = COLUMNS.length + 1

/** The given lifecycles, one expandable row each. `emptyText` fills the body when there are none. */
export function SignBidirectionalLifecycleTable({
  lifecycles,
  emptyText,
}: {
  lifecycles: readonly SignBidirectionalLifecycle[]
  emptyText: string
}) {
  // This wrapper fills the height the page has left. The table component scrolls inside its own
  // container, so that container takes the wrapper's height and the header sticks to it.
  return (
    <div className="bg-card min-h-64 flex-1 overflow-hidden rounded-lg border *:data-[slot=table-container]:h-full *:data-[slot=table-container]:overflow-y-auto">
      <Table>
        {/* The table collapses its borders, so a border on the header's row belongs to the
              table's border grid and scrolls away with the body. An inset shadow is painted by
              the header's own box, which follows the sticky offset. */}
        <TableHeader className="bg-muted sticky top-0 z-10 shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0">
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">Event details</span>
            </TableHead>
            {COLUMNS.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr:last-child]:border-b">
          {lifecycles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="text-muted-foreground text-center">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            lifecycles.map((lifecycle) => (
              <LifecycleRow key={lifecycle.requestId} lifecycle={lifecycle} />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
