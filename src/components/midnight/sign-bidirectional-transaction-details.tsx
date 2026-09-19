import ReactJson from '@microlink/react-json-view'
import { Fragment, useEffect, useState } from 'react'

import { useMidnight } from '@/components/contexts/MidnightContext'
import { useTheme } from '@/components/contexts/ThemeContext'
import { CopyableHex } from '@/components/copyable-hex'
import { PendingIcon } from '@/components/pending-icon'
import { Badge } from '@/components/ui/badge'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { signBidirectionalEventJson } from '@/lib/midnight/sign-bidirectional-event-json'
import type {
  ContractCallNode,
  SignBidirectionalTransactionInspection,
} from '@/lib/midnight/sign-bidirectional-transaction-inspection'
import {
  loadSignBidirectionalTransactionInspection,
  type SignBidirectionalNotificationEvent,
} from '@/lib/midnight/sign-bidirectional-transaction-loader'

type InspectionState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly inspection: SignBidirectionalTransactionInspection }
  | { readonly status: 'error'; readonly error: string }

/** A settled inspection, tagged with what it was loaded for. */
interface SettledInspection {
  readonly indexerUrl: string
  readonly event: SignBidirectionalNotificationEvent
  readonly state: InspectionState
}

function useSignBidirectionalTransactionInspection(
  event: SignBidirectionalNotificationEvent,
): InspectionState {
  const { indexerUrl } = useMidnight().config
  const [settled, setSettled] = useState<SettledInspection | null>(null)

  useEffect(() => {
    let current = true
    const settle = (state: InspectionState) => {
      if (current) {
        setSettled({ indexerUrl, event, state })
      }
    }
    loadSignBidirectionalTransactionInspection(indexerUrl, event).then(
      (inspection) => settle({ status: 'loaded', inspection }),
      (error: unknown) =>
        settle({ status: 'error', error: error instanceof Error ? error.message : String(error) }),
    )
    return () => {
      current = false
    }
  }, [indexerUrl, event])

  // A result settled for other inputs is stale, so the current inputs are still loading.
  return settled?.indexerUrl === indexerUrl && settled.event === event
    ? settled.state
    : { status: 'loading' }
}

function CallChain({ calls }: { calls: readonly ContractCallNode[] }) {
  return (
    <ul className="list-disc pl-5">
      {calls.map((call, index) => (
        <li key={index}>
          <span className="inline-flex items-center gap-2">
            <span className="font-mono">{call.entryPoint}</span>@
            <CopyableHex value={call.address} label={`${call.entryPoint} contract address`} />
            {call.fallible && (
              <Tooltip>
                <TooltipTrigger render={<Badge variant="destructive" />}>fallible</TooltipTrigger>
                <TooltipContent>
                  Runs in the transaction's fallible section. The MPC reads guaranteed transcripts
                  only, so it skips a Signet call made this way.
                </TooltipContent>
              </Tooltip>
            )}
          </span>
          {call.calls.length > 0 && <CallChain calls={call.calls} />}
        </li>
      ))}
    </ul>
  )
}

/**
 * What the transaction that emitted a sign bidirectional notification did: the chain of contract
 * calls under each of its top level calls, and the request record it stored in the caller.
 */
export function SignBidirectionalTransactionDetails({
  event,
}: {
  event: SignBidirectionalNotificationEvent
}) {
  const state = useSignBidirectionalTransactionInspection(event)
  const { theme } = useTheme()

  if (state.status === 'loading') {
    return <PendingIcon />
  }
  if (state.status === 'error') {
    return <p className="text-destructive">Could not inspect the transaction: {state.error}</p>
  }
  const { callChains, request } = state.inspection
  return (
    <>
      <h4 className="font-bold">Call Chain</h4>
      {callChains.map((chain, index) => (
        <Fragment key={index}>
          {index > 0 && <Separator />}
          <CallChain calls={[chain]} />
        </Fragment>
      ))}
      <Separator />
      <h4 className="font-bold">Request at Path in Caller</h4>
      {request === null ? (
        <p className="text-muted-foreground">The transaction stores no request at this path</p>
      ) : (
        <ScrollArea className="bg-muted/50 h-72 rounded-md border">
          <div className="w-max p-2">
            <ReactJson
              src={signBidirectionalEventJson(request)}
              name={false}
              theme={theme === 'dark' ? 'ocean' : 'rjv-default'}
              style={{ backgroundColor: 'transparent' }}
              displayDataTypes={false}
              displayObjectSize={false}
              enableClipboard={false}
              collapseStringsAfterLength={false}
            />
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </>
  )
}
