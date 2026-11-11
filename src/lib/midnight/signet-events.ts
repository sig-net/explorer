import {
  type DecodedSignetEvent,
  type IndexedSignetMiscEvent,
  tryDecodeSignetEvent,
} from '@sig-net/midnight'

/**
 * One event of a signet contract as the explorer stores it. The explorer keeps every event either
 * contract emitted, so the two ways a decode can come up empty are variants of their own. Every
 * variant carries `roles`, those of the contract that emitted it, and `source`, the event as the
 * indexer served it, with its cursor and transaction id.
 */
export type SignetContractEvent = { readonly roles: readonly SignetContractRole[] } & (
  | (DecodedSignetEvent<IndexedSignetMiscEvent> & { readonly kind: 'decoded' })
  /** An event whose name is not a Signet event name. */
  | { readonly kind: 'unrecognised'; readonly source: IndexedSignetMiscEvent }
  /** A Signet event whose payload did not decode. */
  | {
      readonly kind: 'undecodable'
      readonly source: IndexedSignetMiscEvent
      readonly reason: string
    }
)

/**
 * A signet contract's part in the protocol: the signer, which requester contracts notify, or the
 * responder, which the MPC posts through.
 */
export type SignetContractRole = 'signer' | 'responder'

/**
 * Decodes one streamed event of a contract configured in `roles` into the stored form. Failures
 * are variants.
 */
export function decodeSignetContractEvent(
  source: IndexedSignetMiscEvent,
  roles: readonly SignetContractRole[],
): SignetContractEvent {
  const result = tryDecodeSignetEvent(source)
  if (result === undefined) {
    return { roles, kind: 'unrecognised', source }
  }
  return result.ok
    ? { ...result.event, roles, kind: 'decoded' }
    : { roles, kind: 'undecodable', source: result.source, reason: result.reason }
}
