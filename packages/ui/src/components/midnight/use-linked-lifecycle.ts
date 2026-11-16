import type { ExplorerService, InspectedSignBidirectionalLifecycle } from '@sig-net/explorer-api'
import type { MidnightNetwork, RequestIdHex } from '@sig-net/midnight'
import { useEffect, useState } from 'react'

/** The lifecycle a link names, as the backend answers for it. */
export type LinkedLifecycle =
  | { readonly status: 'loading' }
  | { readonly status: 'found'; readonly lifecycle: InspectedSignBidirectionalLifecycle }
  | { readonly status: 'not-found' }
  | { readonly status: 'error'; readonly error: string }

/**
 * Reads the lifecycle of `requestId` on `network`, again whenever `reads` changes. Null while no
 * request is linked or no backend is configured.
 */
export function useLinkedLifecycle(
  service: ExplorerService | null,
  network: MidnightNetwork,
  requestId: RequestIdHex | undefined,
  reads: number,
): LinkedLifecycle | null {
  const [answer, setAnswer] = useState<LinkedLifecycleAnswer | null>(null)
  useEffect(() => {
    let current = true
    if (service !== null && requestId !== undefined) {
      service.lifecycle(network, requestId).then(
        (lifecycle) => {
          if (current) {
            setAnswer({
              network,
              requestId,
              reads,
              linked: lifecycle === null ? { status: 'not-found' } : { status: 'found', lifecycle },
            })
          }
        },
        (error: unknown) => {
          if (current) {
            const message = error instanceof Error ? error.message : String(error)
            setAnswer({ network, requestId, reads, linked: { status: 'error', error: message } })
          }
        },
      )
    }
    return () => {
      current = false
    }
  }, [service, network, requestId, reads])

  if (service === null || requestId === undefined) {
    return null
  }
  if (
    answer === null ||
    answer.network !== network ||
    answer.requestId !== requestId ||
    answer.reads !== reads
  ) {
    return { status: 'loading' }
  }
  return answer.linked
}

/** An answer with the read it answers, so an earlier read's answer is never shown. */
interface LinkedLifecycleAnswer {
  readonly network: MidnightNetwork
  readonly requestId: RequestIdHex
  readonly reads: number
  readonly linked: LinkedLifecycle
}
