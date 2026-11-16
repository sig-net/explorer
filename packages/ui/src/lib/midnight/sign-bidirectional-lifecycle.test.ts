import { bytesToHex, SignetEventName } from '@sig-net/midnight'
import { expect, test } from 'vitest'

import { aggregateSignBidirectionalLifecycles } from '@sig-net/explorer-lib'
import { notificationEvent, responseEvent } from '@sig-net/explorer-lib/testing'
import {
  signBidirectionalLifecycleCalledBy,
  signBidirectionalLifecycleCallers,
  signBidirectionalLifecycleDurationMs,
  signBidirectionalLifecycleMatches,
} from './sign-bidirectional-lifecycle'

const REQUEST_A = new Uint8Array(32).fill(0xaa)
const REQUEST_B = new Uint8Array(32).fill(0xbb)
const CALLER_ONE = new Uint8Array(32).fill(0x11)
const CALLER_TWO = new Uint8Array(32).fill(0x22)

test('duration runs from the first request to the first attestation', () => {
  const [complete] = aggregateSignBidirectionalLifecycles([
    notificationEvent(1, REQUEST_A, CALLER_ONE, 0),
    notificationEvent(2, REQUEST_A, CALLER_ONE, 50),
    responseEvent(3, SignetEventName.RespondBidirectionalEvent, REQUEST_A, 120),
    responseEvent(4, SignetEventName.RespondBidirectionalEvent, REQUEST_A, 500),
  ])
  const [signedOnly] = aggregateSignBidirectionalLifecycles([
    notificationEvent(1, REQUEST_A, CALLER_ONE, 0),
    responseEvent(2, SignetEventName.SignatureRespondedEvent, REQUEST_A, 30),
  ])
  const [orphan] = aggregateSignBidirectionalLifecycles([
    responseEvent(1, SignetEventName.RespondBidirectionalEvent, REQUEST_A, 30),
  ])
  if (complete === undefined || signedOnly === undefined || orphan === undefined) {
    throw new Error('expected one lifecycle each')
  }
  expect(signBidirectionalLifecycleDurationMs(complete)).toBe(120_000)
  expect(signBidirectionalLifecycleDurationMs(signedOnly)).toBeNull()
  expect(signBidirectionalLifecycleDurationMs(orphan)).toBeNull()
})

test('search matches a fragment of the request id or of a caller address', () => {
  const [lifecycle] = aggregateSignBidirectionalLifecycles([
    notificationEvent(1, REQUEST_A, CALLER_ONE, 0),
  ])
  if (lifecycle === undefined) {
    throw new Error('expected a lifecycle')
  }
  expect(signBidirectionalLifecycleMatches(lifecycle, '')).toBe(true)
  expect(signBidirectionalLifecycleMatches(lifecycle, '  AAAA ')).toBe(true)
  expect(signBidirectionalLifecycleMatches(lifecycle, '0x1111')).toBe(true)
  expect(signBidirectionalLifecycleMatches(lifecycle, 'bbbb')).toBe(false)
})

test('the callers are the distinct addresses named, and a lifecycle is called by any it names', () => {
  // Newest first: the orphan response, then the lifecycle of request B, then of request A.
  const [orphan, two, one] = aggregateSignBidirectionalLifecycles([
    notificationEvent(1, REQUEST_A, CALLER_ONE, 0),
    notificationEvent(2, REQUEST_B, CALLER_TWO, 1),
    notificationEvent(3, REQUEST_B, CALLER_ONE, 2),
    responseEvent(4, SignetEventName.RespondBidirectionalEvent, new Uint8Array(32).fill(0xcc), 3),
  ])
  if (one === undefined || two === undefined || orphan === undefined) {
    throw new Error('expected three lifecycles')
  }
  const callerOne = bytesToHex(CALLER_ONE)
  const callerTwo = bytesToHex(CALLER_TWO)
  expect(signBidirectionalLifecycleCallers([orphan, two, one])).toEqual([callerTwo, callerOne])
  expect(signBidirectionalLifecycleCalledBy(two, [callerOne])).toBe(true)
  expect(signBidirectionalLifecycleCalledBy(two, [callerTwo])).toBe(true)
  expect(signBidirectionalLifecycleCalledBy(one, [callerTwo])).toBe(false)
  expect(signBidirectionalLifecycleCalledBy(orphan, [callerOne, callerTwo])).toBe(false)
  expect(signBidirectionalLifecycleCalledBy(one, [])).toBe(false)
})
