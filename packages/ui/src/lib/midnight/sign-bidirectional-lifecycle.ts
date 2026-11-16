import type { SignBidirectionalLifecycle } from '@sig-net/explorer-lib'
import { DateTime } from 'luxon'

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

/** How many events of every kind the lifecycle groups. */
export function signBidirectionalLifecycleEventCount(
  lifecycle: SignBidirectionalLifecycle,
): number {
  return (
    lifecycle.signBidirectionalEvents.length +
    lifecycle.signatureRespondedEvents.length +
    lifecycle.respondBidirectionalEvents.length
  )
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

/** The distinct caller contract addresses the lifecycles name, in first-seen order. */
export function signBidirectionalLifecycleCallers(
  lifecycles: readonly SignBidirectionalLifecycle[],
): string[] {
  const callers = new Set<string>()
  for (const lifecycle of lifecycles) {
    for (const event of lifecycle.signBidirectionalEvents) {
      callers.add(event.record.callerAddress)
    }
  }
  return [...callers]
}

/** Whether the lifecycle names any of `callers`. A lifecycle that names no caller never does. */
export function signBidirectionalLifecycleCalledBy(
  lifecycle: SignBidirectionalLifecycle,
  callers: readonly string[],
): boolean {
  return lifecycle.signBidirectionalEvents.some((event) =>
    callers.includes(event.record.callerAddress),
  )
}
