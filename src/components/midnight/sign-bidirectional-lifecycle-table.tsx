import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

import { CopyableHex } from '@/components/copyable-hex'
import { SignetEventSourcesSection } from '@/components/midnight/signet-event-sources-section'
import { PendingIcon } from '@/components/pending-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  signBidirectionalLifecycleMatches,
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
              <SignetEventSourcesSection
                heading="Sign Bidirectional Notification"
                sources={signBidirectionalEvents.map((event) => event.source)}
              />
              <SignetEventSourcesSection
                heading="Signature Responded Event"
                sources={signatureRespondedEvents.map((event) => event.source)}
              />
              <SignetEventSourcesSection
                heading="Respond Bidirectional Event"
                sources={respondBidirectionalEvents.map((event) => event.source)}
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

export function SignBidirectionalLifecycleTable({
  lifecycles,
}: {
  lifecycles: readonly SignBidirectionalLifecycle[]
}) {
  const [search, setSearch] = useState('')
  const matching = lifecycles.filter((lifecycle) =>
    signBidirectionalLifecycleMatches(lifecycle, search),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input
          // The dark variant is spelled out so it beats the input's own `dark:bg-input/30`.
          className="bg-card dark:bg-card"
          aria-label="Search by request id or caller contract"
          placeholder="Search by request id or caller contract"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Clear search"
          disabled={search === ''}
          onClick={() => setSearch('')}
        >
          <X />
        </Button>
      </div>
      {/* This wrapper fills the height the page has left. The table component scrolls inside its own
          container, so that container takes the wrapper's height and the header sticks to it. */}
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
          <TableBody>
            {matching.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="text-muted-foreground text-center">
                  {lifecycles.length === 0 ? 'No requests yet' : 'No requests match the search'}
                </TableCell>
              </TableRow>
            ) : (
              matching.map((lifecycle) => (
                <LifecycleRow key={lifecycle.requestId} lifecycle={lifecycle} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
