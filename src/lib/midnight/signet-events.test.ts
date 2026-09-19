import {
  bytesToHex,
  type IndexedSignetMiscEvent,
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

function respondPayload(): number[] {
  return [
    ...REQUEST_ID,
    ...new Uint8Array(32).fill(0x33),
    ...new Uint8Array(32).fill(0x44),
    ...new Uint8Array(32).fill(0x55),
    1,
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

test.each([SignetEventName.SignatureRespondedEvent, SignetEventName.RespondBidirectionalEvent])(
  'a %s decodes to its request id and signature',
  (name) => {
    const decoded = decodeSignetContractEvent(signetEvent(name, respondPayload()))
    if (decoded.kind !== 'decoded' || decoded.name === SignetEventName.SignBidirectionalEvent) {
      throw new Error('expected a decoded respond event')
    }
    expect(decoded.name).toBe(name)
    expect(decoded.requestId).toBe(bytesToHex(REQUEST_ID))
    expect(decoded.source).toMatchObject({ id: 7, transactionId: 42 })
    const { signature } = decoded.record
    expect(signature.recoveryId).toBe(1n)
    expect(signature.bigR.x).toEqual(new Uint8Array(32).fill(0x33))
    expect(signature.bigR.y).toEqual(new Uint8Array(32).fill(0x44))
    expect(signature.s).toEqual(new Uint8Array(32).fill(0x55))
  },
)

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
