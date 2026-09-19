import type { IndexedSignetMiscEvent, SignatureRespondedEvent } from '@sig-net/midnight'
import { useEffect, useState } from 'react'

import { useMidnight } from '@/components/contexts/MidnightContext'
import {
  loadSignBidirectionalTransactionInspection,
  type SignBidirectionalNotificationEvent,
} from '@/lib/midnight/sign-bidirectional-transaction-loader'
import { checkSignature } from '@/lib/midnight/signature-check'

interface SignatureResponse {
  readonly record: SignatureRespondedEvent
  readonly source: IndexedSignetMiscEvent
}

/** The valid ids, tagged with the configuration they were checked under. */
interface CheckedResponses {
  readonly indexerUrl: string
  readonly mpcRootPublicKey: string
  readonly validIds: ReadonlySet<number>
}

const NONE: ReadonlySet<number> = new Set()

/**
 * The source ids of the `responses` whose signature is by the signing key of at least one of the
 * `notifications`. Empty until the notifications' transactions are inspected. A notification whose
 * transaction cannot be inspected validates no response.
 */
export function useValidSignatureResponseIds(
  notifications: readonly SignBidirectionalNotificationEvent[],
  responses: readonly SignatureResponse[],
): ReadonlySet<number> {
  const { indexerUrl, mpcRootPublicKey } = useMidnight().config
  const [checked, setChecked] = useState<CheckedResponses | null>(null)

  useEffect(() => {
    let current = true
    void Promise.allSettled(
      notifications.map((notification) =>
        loadSignBidirectionalTransactionInspection(indexerUrl, notification),
      ),
    ).then((inspections) => {
      if (!current) {
        return
      }
      const requests = inspections.flatMap((inspection) =>
        inspection.status === 'fulfilled' && inspection.value.request !== null
          ? [inspection.value.request]
          : [],
      )
      const validIds = new Set(
        responses
          .filter(({ record }) =>
            requests.some(
              (request) => checkSignature(mpcRootPublicKey, request, record).status === 'valid',
            ),
          )
          .map(({ source }) => source.id),
      )
      setChecked({ indexerUrl, mpcRootPublicKey, validIds })
    })
    return () => {
      current = false
    }
  }, [indexerUrl, mpcRootPublicKey, notifications, responses])

  // Ids checked under another configuration are stale. Ids checked for an earlier event list stay
  // true, as an event's id and validity never change.
  return checked?.indexerUrl === indexerUrl && checked.mpcRootPublicKey === mpcRootPublicKey
    ? checked.validIds
    : NONE
}
