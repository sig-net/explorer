import { useRouter } from '@tanstack/react-router'
import { ChevronDown, ChevronUp, Link, ListFilter } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

import { useMidnight } from '@/components/contexts/MidnightContext'
import { CopyButton } from '@/components/copy-button'
import { CopyableHex } from '@/components/copyable-hex'
import { ExternalLinkButton } from '@/components/external-link-button'
import { InfoTooltip } from '@/components/info-tooltip'
import { AttestationCheck } from '@/components/midnight/attestation-check'
import {
  RespondBidirectionalEventDetails,
  SignatureRespondedEventDetails,
  SignBidirectionalNotificationDetails,
} from '@/components/midnight/signet-event-record-details'
import { SignBidirectionalTransactionDetails } from '@/components/midnight/sign-bidirectional-transaction-details'
import { SignatureCheck } from '@/components/midnight/signature-check'
import { SignetEventsSection } from '@/components/midnight/signet-events-section'
import { useLifecycleVerification } from '@/components/midnight/use-lifecycle-verification'
import { PendingIcon } from '@/components/pending-icon'
import { SpinnerSplash } from '@/components/spinner-splash'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Toggle } from '@/components/ui/toggle'
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

/** Block times, each followed by how long after `since` it is when `since` is given. */
function Timestamps({ dates, since }: { dates: readonly Date[]; since?: Date }) {
  return (
    <Stacked>
      {dates.map((date, index) => (
        <span key={index} className="tabular-nums">
          {formatLocalTimestamp(date)}
          {since !== undefined && (
            <span className="text-muted-foreground">
              {' '}
              ({formatDuration(date.getTime() - since.getTime())})
            </span>
          )}
        </span>
      ))}
    </Stacked>
  )
}

const MISSING_NOTIFICATION_EXPLANATION =
  "No Sign Bidirectional Event on this contract declares this request id, so the request's time, caller and record are unknown. The responses answer a request the MPC saw elsewhere: notified on another Signet contract, or never notified at all."

/** The cell content of an event kind the search for the request may still find. */
function SearchingCell() {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1">
      <Spinner aria-label="Searching" />
      searching
    </span>
  )
}

/**
 * The cell content of a lifecycle that holds responses and no request notification: still
 * searching, or `children` as the verdict with its explanation.
 */
function WithoutNotification({ searching, children }: { searching: boolean; children: ReactNode }) {
  if (searching) {
    return <SearchingCell />
  }
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1">
      {children}
      <InfoTooltip label="About the missing notification">
        {MISSING_NOTIFICATION_EXPLANATION}
      </InfoTooltip>
    </span>
  )
}

/** Mounted only while its row is expanded, as it inspects the lifecycle's transactions. */
function LifecycleDetails({
  lifecycle,
  searching,
}: {
  lifecycle: SignBidirectionalLifecycle
  searching: boolean
}) {
  const { signBidirectionalEvents, signatureRespondedEvents, respondBidirectionalEvents } =
    lifecycle
  const { validSignatureResponseIds, attestationChecks } = useLifecycleVerification(lifecycle)
  const validAttestationIds =
    attestationChecks.status === 'checked'
      ? new Set(
          [...attestationChecks.checks]
            .filter(([, { status }]) => status === 'valid')
            .map(([id]) => id),
        )
      : undefined
  // The notification and the signature precede the response, so the search back may still find
  // them. The response is the latest event, so it is never still to come from older blocks.
  const stillSearching = searching ? (
    <SpinnerSplash spinnerLabel="Searching" title="Still searching for event data" />
  ) : undefined
  return (
    <div className="grid grid-cols-3 divide-x">
      <SignetEventsSection
        heading="Sign Bidirectional Notification"
        events={signBidirectionalEvents}
        empty={
          stillSearching ?? (
            <p className="text-muted-foreground">{MISSING_NOTIFICATION_EXPLANATION}</p>
          )
        }
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
        successfulEventIds={validSignatureResponseIds}
        empty={stillSearching}
        renderRecord={(event) => (
          <>
            <SignatureRespondedEventDetails record={event.record} />
            <Separator />
            <SignatureCheck notifications={signBidirectionalEvents} response={event.record} />
          </>
        )}
      />
      <SignetEventsSection
        heading="Respond Bidirectional Event"
        events={respondBidirectionalEvents}
        successfulEventIds={validAttestationIds}
        renderRecord={(event) => (
          <>
            <RespondBidirectionalEventDetails record={event.record} />
            <Separator />
            <AttestationCheck checks={attestationChecks} eventId={event.source.id} />
          </>
        )}
      />
    </div>
  )
}

function LifecycleRow({
  lifecycle,
  expandedByDefault,
  searching,
}: {
  lifecycle: SignBidirectionalLifecycle
  expandedByDefault: boolean
  searching: boolean
}) {
  const { signBidirectionalEvents, signatureRespondedEvents, respondBidirectionalEvents } =
    lifecycle
  const durationMs = signBidirectionalLifecycleDurationMs(lifecycle)
  const requestedAt = signBidirectionalEvents[0]?.source.blockTimestamp
  // Null until the row is toggled by hand. A toggled row keeps that choice, and an untouched one
  // follows the default as it changes.
  const [toggled, setToggled] = useState<boolean | null>(null)
  const expanded = toggled ?? expandedByDefault
  const detailsId = useId()
  const router = useRouter()
  const { network } = useMidnight()
  // The public href carries the base path the app is served under.
  const requestUrl = new URL(
    router.buildLocation({
      to: '/midnight/explorer',
      search: { networkId: network, requestId: lifecycle.requestId },
    }).publicHref,
    window.location.origin,
  ).href
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
            onClick={() => setToggled(!expanded)}
          >
            {expanded ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </TableCell>
        <TableCell>
          {signBidirectionalEvents.length === 0 ? (
            <WithoutNotification searching={searching}>no notification</WithoutNotification>
          ) : (
            <Timestamps
              dates={signBidirectionalEvents.map((event) => event.source.blockTimestamp)}
            />
          )}
        </TableCell>
        <TableCell>
          <span className="inline-flex items-center gap-1">
            <CopyableHex value={lifecycle.requestId} label="request id" />
            <CopyButton
              value={requestUrl}
              label="link to this request"
              icon={<Link />}
              tooltip="Copy a link to share this request"
            />
            <ExternalLinkButton href={requestUrl} label="Open this request in a new tab" />
          </span>
        </TableCell>
        <TableCell>
          {signBidirectionalEvents.length === 0 ? (
            <WithoutNotification searching={searching}>unknown</WithoutNotification>
          ) : (
            <Stacked>
              {signBidirectionalEvents.map((event) => (
                <CopyableHex
                  key={event.source.id}
                  value={event.record.callerAddress}
                  label="caller address"
                />
              ))}
            </Stacked>
          )}
        </TableCell>
        <TableCell>Bidirectional</TableCell>
        <TableCell>
          {signatureRespondedEvents.length === 0 ? (
            searching ? (
              <SearchingCell />
            ) : (
              <PendingIcon tooltip="Waiting for the MPC to provide the signature" />
            )
          ) : (
            <Timestamps
              dates={signatureRespondedEvents.map((event) => event.source.blockTimestamp)}
              since={requestedAt}
            />
          )}
        </TableCell>
        <TableCell>
          {respondBidirectionalEvents.length === 0 ? (
            <PendingIcon tooltip="Waiting for the MPC to attest the response. An attestation is only expected once the foreign transaction is finalised, which takes up to 15 minutes on an EVM chain." />
          ) : (
            <Timestamps
              dates={respondBidirectionalEvents.map((event) => event.source.blockTimestamp)}
            />
          )}
        </TableCell>
        <TableCell>
          {signBidirectionalEvents.length === 0 ? (
            <WithoutNotification searching={searching}>unknown</WithoutNotification>
          ) : durationMs === null ? (
            <PendingIcon />
          ) : (
            formatDuration(durationMs)
          )}
        </TableCell>
        <TableCell />
      </TableRow>
      {expanded && (
        <TableRow id={detailsId} className="hover:bg-transparent">
          <TableCell colSpan={COLUMN_COUNT} className="p-0 whitespace-normal">
            <LifecycleDetails lifecycle={lifecycle} searching={searching} />
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

/** The named columns, the leading expand control's column and the trailing filter control's. */
const COLUMN_COUNT = COLUMNS.length + 2

/**
 * The given lifecycles, one expandable row each. `emptyText` fills the body when there are none.
 * With `expandSoleRow`, a row that is the only one starts expanded. `filterPanel` opens under the
 * header from the button at its end.
 *
 * `searching` is true while the request the rows are filtered to is still being searched for in
 * older blocks: an empty body shows the search in place of `emptyText`, and a row's missing
 * notification and signature show as searching rather than missing. `loading` is true while the
 * events are still being read: an empty body that is not searching shows the load in place of
 * `emptyText`.
 */
export function SignBidirectionalLifecycleTable({
  lifecycles,
  emptyText,
  expandSoleRow,
  searching,
  loading,
  filterPanel,
}: {
  lifecycles: readonly SignBidirectionalLifecycle[]
  emptyText: string
  expandSoleRow: boolean
  searching: boolean
  loading: boolean
  filterPanel: ReactNode
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  // This wrapper fills the height the page has left. The table component scrolls inside its own
  // container, which shrinks to the wrapper and keeps the header stuck to its top, and an empty
  // body's notice takes the height below it.
  return (
    <div className="bg-card flex min-h-64 flex-1 flex-col overflow-hidden rounded-lg border *:data-[slot=table-container]:min-h-0 *:data-[slot=table-container]:overflow-y-auto">
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
            <TableHead className="w-10 text-right">
              <Toggle
                size="sm"
                aria-label="Filters"
                pressed={filtersOpen}
                onPressedChange={setFiltersOpen}
                className="text-muted-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
              >
                <ListFilter />
              </Toggle>
            </TableHead>
          </TableRow>
          {/* The row's background covers the header's inset divider, so the cell paints its own. */}
          {filtersOpen && (
            <TableRow className="bg-card border-t hover:bg-card">
              <TableCell
                colSpan={COLUMN_COUNT}
                className="whitespace-normal shadow-[inset_0_-1px_0_var(--border)]"
              >
                {filterPanel}
              </TableCell>
            </TableRow>
          )}
        </TableHeader>
        <TableBody className="[&_tr:last-child]:border-b">
          {lifecycles.map((lifecycle) => (
            <LifecycleRow
              key={lifecycle.requestId}
              lifecycle={lifecycle}
              expandedByDefault={expandSoleRow && lifecycles.length === 1}
              searching={searching}
            />
          ))}
        </TableBody>
      </Table>
      {lifecycles.length === 0 &&
        (searching ? (
          <SpinnerSplash
            spinnerLabel="Searching"
            title="Looking back through Sig Network events for this request"
          >
            Responses are posted some time after a request, so a request's own events sit in older
            blocks than its responses. The starting block steps back until the request is found or
            the contract's earliest block is reached.
          </SpinnerSplash>
        ) : loading ? (
          <SpinnerSplash spinnerLabel="Loading" title="Loading Sig Network events">
            Requests appear as their blocks are read, newest first.
          </SpinnerSplash>
        ) : (
          <Empty>
            <EmptyDescription>{emptyText}</EmptyDescription>
          </Empty>
        ))}
    </div>
  )
}
