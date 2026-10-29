import { type IndexedSignetMiscEvent, SignetEventName } from '@sig-net/midnight'
import { DateTime } from 'luxon'

import { decodeSignetContractEvent, type SignetContractEvent } from '@/lib/midnight/signet-events'

/** The block time of event 0: later events follow it second by second. */
export const LIFECYCLE_FIXTURE_START = DateTime.fromISO('2026-09-07T12:00:00Z')

/** An event of `name` whose payload starts with `bytes`, indexed at `id` in block `1000 + id`. */
export function indexedSignetContractEvent(
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
    blockTimestamp: LIFECYCLE_FIXTURE_START.plus({ seconds: secondsAfterStart }).toJSDate(),
  }
  return decodeSignetContractEvent(source)
}

/** A request notification by `caller` for `requestId`, declaring a four byte record. */
export function notificationEvent(
  id: number,
  requestId: Uint8Array,
  caller: Uint8Array,
  seconds: number,
): SignetContractEvent {
  const bytes = [1, ...requestId, ...caller, 1, 4, 0, 0, 0]
  return indexedSignetContractEvent(id, SignetEventName.SignBidirectionalEvent, bytes, seconds)
}

/** A response of kind `name` for `requestId`, carrying a signature of 0x33 bytes. */
export function responseEvent(
  id: number,
  name: SignetEventName,
  requestId: Uint8Array,
  seconds: number,
): SignetContractEvent {
  const signature = [...new Uint8Array(96).fill(0x33), 1]
  // A respond bidirectional payload holds 81 bytes between the request id and the signature: block
  // height, output kind, output length, output hash and digest. Zeros decode as an executed, empty
  // output.
  const attested = name === SignetEventName.RespondBidirectionalEvent ? new Uint8Array(81) : []
  return indexedSignetContractEvent(id, name, [...requestId, ...attested, ...signature], seconds)
}
