import { Check, Clock, Copy, X } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'

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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDuration, formatUtcTimestamp, truncateMiddle } from '@/lib/format'
import {
  type SignBidirectionalLifecycle,
  signBidirectionalLifecycleDurationMs,
  signBidirectionalLifecycleMatches,
} from '@/lib/midnight/sign-bidirectional-lifecycle'

/** Entries shown in one cell before the rest collapse into an ellipsis. */
const MAX_STACKED = 3

function Pending() {
  return <Clock role="img" aria-label="Pending" className="text-muted-foreground size-4" />
}

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

/** How long the copy button shows its confirmation. */
const COPIED_FEEDBACK_MS = 1500

/** A long hex value, truncated, with its full form on hover and a button that copies it. */
function CopyableHex({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const timer = copied ? setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS) : null
    return () => {
      if (timer !== null) {
        clearTimeout(timer)
      }
    }
  }, [copied])

  const copy = () => {
    void navigator.clipboard.writeText(value).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger render={<span className="font-mono" />}>
          {truncateMiddle(value)}
        </TooltipTrigger>
        {/* The popup's default width cap is narrower than a 32-byte hex value, which cannot wrap. */}
        <TooltipContent className="max-w-none! font-mono">{value}</TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
        onClick={copy}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </span>
  )
}

function Timestamps({ dates }: { dates: readonly Date[] }) {
  return (
    <Stacked>
      {dates.map((date, index) => (
        <span key={index} className="tabular-nums">
          {formatUtcTimestamp(date)}
        </span>
      ))}
    </Stacked>
  )
}

function LifecycleRow({ lifecycle }: { lifecycle: SignBidirectionalLifecycle }) {
  const { signBidirectionalEvents, signatureRespondedEvents, respondBidirectionalEvents } =
    lifecycle
  const durationMs = signBidirectionalLifecycleDurationMs(lifecycle)
  return (
    <TableRow className="[&>td]:align-top">
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
          <Pending />
        ) : (
          <Timestamps
            dates={signatureRespondedEvents.map((event) => event.source.blockTimestamp)}
          />
        )}
      </TableCell>
      <TableCell>
        {respondBidirectionalEvents.length === 0 ? (
          <Pending />
        ) : (
          <Timestamps
            dates={respondBidirectionalEvents.map((event) => event.source.blockTimestamp)}
          />
        )}
      </TableCell>
      <TableCell>{durationMs === null ? <Pending /> : formatDuration(durationMs)}</TableCell>
    </TableRow>
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
              {COLUMNS.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {matching.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="text-muted-foreground text-center">
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
