import { bytesToHex, type IndexedSignetMiscEvent, SignetEventName } from '@sig-net/midnight'
import { DateTime } from 'luxon'
import { expect, test } from 'vitest'

import {
  aggregateSignBidirectionalLifecycles,
  signBidirectionalLifecycleDurationMs,
  signBidirectionalLifecycleEventCount,
  signBidirectionalLifecycleMatches,
} from './sign-bidirectional-lifecycle'
import { decodeSignetContractEvent, type SignetContractEvent } from './signet-events'

const START = DateTime.fromISO('2026-09-07T12:00:00Z')
const REQUEST_A = new Uint8Array(32).fill(0xaa)
const REQUEST_B = new Uint8Array(32).fill(0xbb)
const CALLER_ONE = new Uint8Array(32).fill(0x11)
const CALLER_TWO = new Uint8Array(32).fill(0x22)

function indexed(
  id: number,
  name: string,
  bytes: readonly number[],
  secondsAfterStart: number,
): SignetContractEvent {
  const payload = new Uint8Array(256)
  payload.set(bytes)
  const source: IndexedSignetMiscEvent = {
    name,
    payload,
    id,
    maxId: 100,
    transactionId: id,
    transactionHash: id.toString(16).padStart(64, '0'),
    blockHeight: 1000 + id,
    blockHash: 'c0'.repeat(32),
    blockTimestamp: START.plus({ seconds: secondsAfterStart }).toJSDate(),
  }
  return decodeSignetContractEvent(source)
}

function request(id: number, requestId: Uint8Array, caller: Uint8Array, seconds: number) {
  const bytes = [1, ...requestId, ...caller, 1, 4, 0, 0, 0]
  return indexed(id, SignetEventName.SignBidirectionalEvent, bytes, seconds)
}

function respond(id: number, name: SignetEventName, requestId: Uint8Array, seconds: number) {
  return indexed(id, name, [...requestId, ...new Uint8Array(96).fill(0x33), 1], seconds)
}

test('events group by declared request id, newest lifecycle first', () => {
  const lifecycles = aggregateSignBidirectionalLifecycles([
    request(1, REQUEST_A, CALLER_ONE, 0),
    respond(2, SignetEventName.SignatureRespondedEvent, REQUEST_A, 30),
    request(3, REQUEST_B, CALLER_TWO, 60),
    respond(4, SignetEventName.RespondBidirectionalEvent, REQUEST_A, 300),
  ])
  expect(lifecycles.map((lifecycle) => lifecycle.requestId)).toEqual([
    bytesToHex(REQUEST_B),
    bytesToHex(REQUEST_A),
  ])
  const [second, first] = lifecycles
  expect(first?.signBidirectionalEvents.map((event) => event.source.id)).toEqual([1])
  expect(first?.signatureRespondedEvents.map((event) => event.source.id)).toEqual([2])
  expect(first?.respondBidirectionalEvents.map((event) => event.source.id)).toEqual([4])
  expect(second?.signBidirectionalEvents).toHaveLength(1)
  expect(second?.signatureRespondedEvents).toEqual([])
  expect(second?.respondBidirectionalEvents).toEqual([])
})

test('repeated emissions under one request id are all kept, in emission order', () => {
  const [lifecycle] = aggregateSignBidirectionalLifecycles([
    request(1, REQUEST_A, CALLER_ONE, 0),
    request(2, REQUEST_A, CALLER_TWO, 5),
    respond(3, SignetEventName.SignatureRespondedEvent, REQUEST_A, 10),
    respond(4, SignetEventName.SignatureRespondedEvent, REQUEST_A, 11),
  ])
  expect(lifecycle?.signBidirectionalEvents.map((event) => event.record.callerAddress)).toEqual([
    bytesToHex(CALLER_ONE),
    bytesToHex(CALLER_TWO),
  ])
  expect(lifecycle?.signatureRespondedEvents.map((event) => event.source.id)).toEqual([3, 4])
  expect(lifecycle && signBidirectionalLifecycleEventCount(lifecycle)).toBe(4)
})

test('a response with no request still forms a lifecycle', () => {
  const [lifecycle] = aggregateSignBidirectionalLifecycles([
    respond(9, SignetEventName.RespondBidirectionalEvent, REQUEST_B, 0),
  ])
  expect(lifecycle?.requestId).toBe(bytesToHex(REQUEST_B))
  expect(lifecycle?.signBidirectionalEvents).toEqual([])
  expect(lifecycle?.respondBidirectionalEvents).toHaveLength(1)
})

test('events that did not decode join no lifecycle', () => {
  const lifecycles = aggregateSignBidirectionalLifecycles([
    indexed(1, 'SomethingElse', [0xff], 0),
    indexed(2, SignetEventName.SignBidirectionalEvent, [2, ...REQUEST_A], 1),
  ])
  expect(lifecycles).toEqual([])
})

test('duration runs from the first request to the first attestation', () => {
  const [complete] = aggregateSignBidirectionalLifecycles([
    request(1, REQUEST_A, CALLER_ONE, 0),
    request(2, REQUEST_A, CALLER_ONE, 50),
    respond(3, SignetEventName.RespondBidirectionalEvent, REQUEST_A, 120),
    respond(4, SignetEventName.RespondBidirectionalEvent, REQUEST_A, 500),
  ])
  const [signedOnly] = aggregateSignBidirectionalLifecycles([
    request(1, REQUEST_A, CALLER_ONE, 0),
    respond(2, SignetEventName.SignatureRespondedEvent, REQUEST_A, 30),
  ])
  const [orphan] = aggregateSignBidirectionalLifecycles([
    respond(1, SignetEventName.RespondBidirectionalEvent, REQUEST_A, 30),
  ])
  if (complete === undefined || signedOnly === undefined || orphan === undefined) {
    throw new Error('expected one lifecycle each')
  }
  expect(signBidirectionalLifecycleDurationMs(complete)).toBe(120_000)
  expect(signBidirectionalLifecycleDurationMs(signedOnly)).toBeNull()
  expect(signBidirectionalLifecycleDurationMs(orphan)).toBeNull()
})

test('search matches a fragment of the request id or of a caller address', () => {
  const [lifecycle] = aggregateSignBidirectionalLifecycles([request(1, REQUEST_A, CALLER_ONE, 0)])
  if (lifecycle === undefined) {
    throw new Error('expected a lifecycle')
  }
  expect(signBidirectionalLifecycleMatches(lifecycle, '')).toBe(true)
  expect(signBidirectionalLifecycleMatches(lifecycle, '  AAAA ')).toBe(true)
  expect(signBidirectionalLifecycleMatches(lifecycle, '0x1111')).toBe(true)
  expect(signBidirectionalLifecycleMatches(lifecycle, 'bbbb')).toBe(false)
})
