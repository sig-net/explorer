import { useEffect, useState } from 'react'

import { useMidnight } from '@/components/contexts/MidnightContext'
import type { SignBidirectionalTransactionInspection } from '@/lib/midnight/sign-bidirectional-transaction-inspection'
import {
  loadSignBidirectionalTransactionInspection,
  type SignBidirectionalNotificationEvent,
} from '@/lib/midnight/sign-bidirectional-transaction-loader'

export type SignBidirectionalTransactionInspectionState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly inspection: SignBidirectionalTransactionInspection }
  | { readonly status: 'error'; readonly error: string }

/** A settled inspection, tagged with what it was loaded for. */
interface SettledInspection {
  readonly indexerUrl: string
  readonly event: SignBidirectionalNotificationEvent
  readonly state: SignBidirectionalTransactionInspectionState
}

/** The inspection of the transaction that emitted `event`, from the configured indexer. */
export function useSignBidirectionalTransactionInspection(
  event: SignBidirectionalNotificationEvent,
): SignBidirectionalTransactionInspectionState {
  const { indexerUrl } = useMidnight().config
  const [settled, setSettled] = useState<SettledInspection | null>(null)

  useEffect(() => {
    let current = true
    const settle = (state: SignBidirectionalTransactionInspectionState) => {
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
