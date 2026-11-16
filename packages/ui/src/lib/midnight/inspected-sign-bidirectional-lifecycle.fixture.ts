import type {
  InspectedSignBidirectionalLifecycle,
  SignBidirectionalInspection,
} from '@sig-net/explorer-api'
import {
  aggregateSignBidirectionalLifecycles,
  type SignetContractEvent,
} from '@sig-net/explorer-lib'

/**
 * The one lifecycle `events` group into, as the explorer serves it, with `inspection` on every
 * notification.
 */
export function inspectedLifecycle(
  events: readonly SignetContractEvent[],
  inspection: SignBidirectionalInspection,
): InspectedSignBidirectionalLifecycle {
  const [lifecycle, ...others] = aggregateSignBidirectionalLifecycles(events)
  if (lifecycle === undefined || others.length > 0) {
    throw new Error('expected the events to group into one lifecycle')
  }
  return {
    ...lifecycle,
    firstEventId: Math.min(...events.map(({ source }) => source.id)),
    signBidirectionalEvents: lifecycle.signBidirectionalEvents.map((event) => ({
      ...event,
      inspection,
    })),
  }
}
