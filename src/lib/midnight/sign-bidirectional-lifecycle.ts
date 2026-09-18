import {
  type DecodedSignetEventNamed,
  type IndexedSignetMiscEvent,
  type RequestIdHex,
  SignetEventName,
} from '@sig-net/midnight'
import { DateTime } from 'luxon'

import type { SignetContractEvent } from '@/lib/midnight/signet-events'

type IndexedSignetEventNamed<TName extends SignetEventName> = DecodedSignetEventNamed<
  TName,
  IndexedSignetMiscEvent
>

/**
 * Every decoded event that declares one request id, grouped by kind in emission order. The
 * contract is unauthenticated and nothing stops a kind being emitted twice, or a response being
 * emitted for a request that never was, so each kind is a list and any of them may be empty. The
 * grouping is by DECLARED id only: it verifies nothing.
 */
export interface SignBidirectionalLifecycle {
  readonly requestId: RequestIdHex
  readonly signBidirectionalEvents: readonly IndexedSignetEventNamed<SignetEventName.SignBidirectionalEvent>[]
  readonly signatureRespondedEvents: readonly IndexedSignetEventNamed<SignetEventName.SignatureRespondedEvent>[]
  readonly respondBidirectionalEvents: readonly IndexedSignetEventNamed<SignetEventName.RespondBidirectionalEvent>[]
}

interface LifecycleDraft {
  requestId: RequestIdHex
  signBidirectionalEvents: IndexedSignetEventNamed<SignetEventName.SignBidirectionalEvent>[]
  signatureRespondedEvents: IndexedSignetEventNamed<SignetEventName.SignatureRespondedEvent>[]
  respondBidirectionalEvents: IndexedSignetEventNamed<SignetEventName.RespondBidirectionalEvent>[]
}

/** The lifecycle's earliest event of any kind. Each list is in emission order. */
function firstSource(lifecycle: SignBidirectionalLifecycle): IndexedSignetMiscEvent | null {
  const firsts = [
    lifecycle.signBidirectionalEvents[0],
    lifecycle.signatureRespondedEvents[0],
    lifecycle.respondBidirectionalEvents[0],
  ].flatMap((event) => (event === undefined ? [] : [event.source]))
  return firsts.reduce<IndexedSignetMiscEvent | null>(
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
  // The indexer's event id ascends in emission order, so it orders lifecycles without comparing
  // block times, which tie for events in one block.
  return Array.from(drafts.values()).sort(
    (a, b) => (firstSource(b)?.id ?? 0) - (firstSource(a)?.id ?? 0),
  )
}

/**
 * Milliseconds from the first request to the first attestation of its foreign execution, or null
 * while either is missing or carries a timestamp that does not parse. A response the indexer
 * stamps before its request yields a negative count, which callers render with its sign.
 */
export function signBidirectionalLifecycleDurationMs(
  lifecycle: SignBidirectionalLifecycle,
): number | null {
  const requested = lifecycle.signBidirectionalEvents[0]?.source.blockTimestamp
  const responded = lifecycle.respondBidirectionalEvents[0]?.source.blockTimestamp
  if (requested === undefined || responded === undefined) {
    return null
  }
  const elapsed = DateTime.fromJSDate(responded).diff(DateTime.fromJSDate(requested))
  return elapsed.isValid ? elapsed.toMillis() : null
}

/**
 * Whether a lifecycle matches a typed search: a case-insensitive fragment of its request id or of
 * any caller contract address it names, with an optional `0x` prefix. An empty search matches all.
 */
export function signBidirectionalLifecycleMatches(
  lifecycle: SignBidirectionalLifecycle,
  search: string,
): boolean {
  const fragment = search.trim().toLowerCase().replace(/^0x/, '')
  if (fragment === '') {
    return true
  }
  return (
    lifecycle.requestId.includes(fragment) ||
    lifecycle.signBidirectionalEvents.some((event) => event.record.callerAddress.includes(fragment))
  )
}
