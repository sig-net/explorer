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
