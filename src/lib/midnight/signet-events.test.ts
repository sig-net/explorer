import {
  bytesToHex,
  type IndexedSignetMiscEvent,
  OutputKind,
  SIGNET_EVENT_PAYLOAD_LENGTH,
  SignetEventName,
} from '@sig-net/midnight'
import { DateTime } from 'luxon'
import { expect, test } from 'vitest'

import { decodeSignetContractEvent } from './signet-events'

const REQUEST_ID = new Uint8Array(32).fill(0x11)
const CALLER_ADDRESS = new Uint8Array(32).fill(0x22)

/** Pads `bytes` to the full payload width, as the SDK's event source does. */
function payloadOf(bytes: readonly number[]): Uint8Array {
  const padded = new Uint8Array(SIGNET_EVENT_PAYLOAD_LENGTH)
  padded.set(bytes)
  return padded
}

function signetEvent(name: string, payload: readonly number[]): IndexedSignetMiscEvent {
  return {
    name,
    payload: payloadOf(payload),
    id: 7,
    maxId: 9,
    transactionId: 42,
    transactionHash: 'e5'.repeat(32),
    blockHeight: 382086,
    blockHash: 'c0'.repeat(32),
    blockTimestamp: DateTime.fromISO('2026-09-09T05:46:00Z').toJSDate(),
  }
}

function notificationPayload(version: number, depth: number): number[] {
  return [version, ...REQUEST_ID, ...CALLER_ADDRESS, depth, 4, 0, 0, 0]
}

const SIGNATURE_BYTES = [
  ...new Uint8Array(32).fill(0x33),
  ...new Uint8Array(32).fill(0x44),
  ...new Uint8Array(32).fill(0x55),
  1,
]
const DIGEST = new Uint8Array(32).fill(0x66)

function signatureRespondedPayload(): number[] {
  return [...REQUEST_ID, ...SIGNATURE_BYTES]
}

/** Block height 258 and output length 3, each as 8 little-endian bytes, around output kind 1. */
function respondBidirectionalPayload(): number[] {
  return [
    ...REQUEST_ID,
    ...[2, 1, 0, 0, 0, 0, 0, 0],
    1,
    ...[3, 0, 0, 0, 0, 0, 0, 0],
    ...DIGEST,
    ...SIGNATURE_BYTES,
  ]
}

test('a sign bidirectional event decodes to its request id and notification', () => {
  const source = signetEvent(SignetEventName.SignBidirectionalEvent, notificationPayload(1, 1))
  expect(decodeSignetContractEvent(source)).toEqual({
    kind: 'decoded',
    name: SignetEventName.SignBidirectionalEvent,
    requestId: bytesToHex(REQUEST_ID),
    record: { version: 1, callerAddress: bytesToHex(CALLER_ADDRESS), requestsPath: [4] },
    source,
  })
})

test('a signature responded event decodes to its request id and signature', () => {
  const decoded = decodeSignetContractEvent(
    signetEvent(SignetEventName.SignatureRespondedEvent, signatureRespondedPayload()),
  )
  if (decoded.kind !== 'decoded' || decoded.name !== SignetEventName.SignatureRespondedEvent) {
    throw new Error('expected a decoded signature responded event')
  }
  expect(decoded.requestId).toBe(bytesToHex(REQUEST_ID))
  expect(decoded.source).toMatchObject({ id: 7, transactionId: 42 })
  expect(decoded.record).toEqual({
    requestId: REQUEST_ID,
    signature: {
      bigR: { x: new Uint8Array(32).fill(0x33), y: new Uint8Array(32).fill(0x44) },
      s: new Uint8Array(32).fill(0x55),
      recoveryId: 1n,
    },
  })
})

test('a respond bidirectional event decodes to everything its attestation declares', () => {
  const decoded = decodeSignetContractEvent(
    signetEvent(SignetEventName.RespondBidirectionalEvent, respondBidirectionalPayload()),
  )
  if (decoded.kind !== 'decoded' || decoded.name !== SignetEventName.RespondBidirectionalEvent) {
    throw new Error('expected a decoded respond bidirectional event')
  }
  expect(decoded.requestId).toBe(bytesToHex(REQUEST_ID))
  expect(decoded.record).toEqual({
    requestId: REQUEST_ID,
    blockHeight: 258n,
    outputKind: OutputKind.failed,
    serializedOutputLength: 3n,
    digest: DIGEST,
    signature: {
      bigR: { x: new Uint8Array(32).fill(0x33), y: new Uint8Array(32).fill(0x44) },
      s: new Uint8Array(32).fill(0x55),
      recoveryId: 1n,
    },
  })
})

test('a respond bidirectional event with an unknown output kind is kept as undecodable', () => {
  const payload = respondBidirectionalPayload()
  payload[40] = 3
  const decoded = decodeSignetContractEvent(
    signetEvent(SignetEventName.RespondBidirectionalEvent, payload),
  )
  expect(decoded.kind).toBe('undecodable')
  if (decoded.kind !== 'undecodable') {
    throw new Error('expected an undecodable event')
  }
  expect(decoded.reason).toContain('unknown output kind 3')
})

test('an unknown event name is kept as unrecognised', () => {
  const source = signetEvent('SomethingElse', [0xff])
  expect(decodeSignetContractEvent(source)).toEqual({ kind: 'unrecognised', source })
})

test('a notification with an unsupported version is kept as undecodable', () => {
  const decoded = decodeSignetContractEvent(
    signetEvent(SignetEventName.SignBidirectionalEvent, notificationPayload(2, 1)),
  )
  expect(decoded.kind).toBe('undecodable')
  if (decoded.kind !== 'undecodable') {
    throw new Error('expected an undecodable event')
  }
  expect(decoded.source.name).toBe(SignetEventName.SignBidirectionalEvent)
  expect(decoded.reason).toContain('version 2')
})

test('a notification with a zero path depth is kept as undecodable', () => {
  const decoded = decodeSignetContractEvent(
    signetEvent(SignetEventName.SignBidirectionalEvent, notificationPayload(1, 0)),
  )
  expect(decoded.kind).toBe('undecodable')
  if (decoded.kind !== 'undecodable') {
    throw new Error('expected an undecodable event')
  }
  expect(decoded.reason).toContain('out of range')
})
