import { type DecodedSignetEventNamed, type RequestIdHex, SignetEventName } from '@sig-net/midnight'

import type {
  SignetContractEvent,
  SignetContractRole,
  StoredSignetMiscEvent,
} from './signet-events.ts'

/**
 * Every decoded event that declares one request id, grouped by kind in emission order. The signer
 * and the responder are unauthenticated and nothing stops a kind being emitted twice, or a
 * response being emitted for a request that never was, so each kind is a list and any of them may
 * be empty. The grouping is by DECLARED id only: it verifies nothing.
 */
export interface SignBidirectionalLifecycle {
  readonly requestId: RequestIdHex
  readonly signBidirectionalEvents: readonly StoredSignetEventNamed<SignetEventName.SignBidirectionalEvent>[]
  readonly signatureRespondedEvents: readonly StoredSignetEventNamed<SignetEventName.SignatureRespondedEvent>[]
  readonly respondBidirectionalEvents: readonly StoredSignetEventNamed<SignetEventName.RespondBidirectionalEvent>[]
}

/** A decoded event of kind `TName` as the store holds it, with the roles of its emitter. */
type StoredSignetEventNamed<TName extends SignetEventName> = DecodedSignetEventNamed<
  TName,
  StoredSignetMiscEvent
> & { readonly roles: readonly SignetContractRole[] }

interface LifecycleDraft {
  requestId: RequestIdHex
  signBidirectionalEvents: StoredSignetEventNamed<SignetEventName.SignBidirectionalEvent>[]
  signatureRespondedEvents: StoredSignetEventNamed<SignetEventName.SignatureRespondedEvent>[]
  respondBidirectionalEvents: StoredSignetEventNamed<SignetEventName.RespondBidirectionalEvent>[]
}

/** The lifecycle's earliest event of any kind. Each list is in emission order. */
function firstSource(lifecycle: SignBidirectionalLifecycle): StoredSignetMiscEvent | null {
  const firsts = [
    lifecycle.signBidirectionalEvents[0],
    lifecycle.signatureRespondedEvents[0],
    lifecycle.respondBidirectionalEvents[0],
  ].flatMap((event) => (event === undefined ? [] : [event.source]))
  return firsts.reduce<StoredSignetMiscEvent | null>(
    (earliest, source) => (earliest === null || source.id < earliest.id ? source : earliest),
    null,
  )
}

/**
 * Groups decoded events by their declared request id, newest activity first: lifecycles are
 * ordered by their earliest event, latest at the top. `events` must be in emission order. Events
 * that are not decoded carry no request id and are left out.
 */
export function aggregateSignBidirectionalLifecycles(
  events: readonly SignetContractEvent[],
): SignBidirectionalLifecycle[] {
  const drafts = new Map<RequestIdHex, LifecycleDraft>()
  for (const event of events) {
    if (event.kind !== 'decoded') {
      continue
    }
    let draft = drafts.get(event.requestId)
    if (draft === undefined) {
      draft = {
        requestId: event.requestId,
        signBidirectionalEvents: [],
        signatureRespondedEvents: [],
        respondBidirectionalEvents: [],
      }
      drafts.set(event.requestId, draft)
    }
    switch (event.name) {
      case SignetEventName.SignBidirectionalEvent:
        draft.signBidirectionalEvents.push(event)
        break
      case SignetEventName.SignatureRespondedEvent:
        draft.signatureRespondedEvents.push(event)
        break
      case SignetEventName.RespondBidirectionalEvent:
        draft.respondBidirectionalEvents.push(event)
        break
      default: {
        const exhaustive: never = event
        throw new Error(`unhandled signet event ${String(exhaustive)}`)
      }
    }
  }
  // The indexer's event id ascends in emission order across both contracts, so it orders
  // lifecycles without comparing block times, which tie for events in one block.
  return Array.from(drafts.values()).sort(
    (a, b) => (firstSource(b)?.id ?? 0) - (firstSource(a)?.id ?? 0),
  )
}
