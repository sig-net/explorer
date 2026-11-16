import { SignetEventName } from '@sig-net/midnight'
import { expect, test } from 'vitest'

import { aggregateSignBidirectionalLifecycles } from '@sig-net/explorer-lib'
import { notificationEvent, responseEvent } from '@sig-net/explorer-lib/testing'
import { signBidirectionalLifecycleDurationMs } from './sign-bidirectional-lifecycle'

const REQUEST_A = new Uint8Array(32).fill(0xaa)
const CALLER_ONE = new Uint8Array(32).fill(0x11)

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
