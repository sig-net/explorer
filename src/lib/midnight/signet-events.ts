import {
  type DecodedSignetEvent,
  type IndexedSignetMiscEvent,
  tryDecodeSignetEvent,
} from '@sig-net/midnight'

/**
 * One Signet contract event as the explorer stores it. The explorer keeps every event the
 * contract emitted, so the two ways a decode can come up empty are variants of their own. Every
 * variant carries `source`, the event as the indexer served it, with its cursor and transaction
 * id.
 */
export type SignetContractEvent =
  | (DecodedSignetEvent<IndexedSignetMiscEvent> & { readonly kind: 'decoded' })
  /** An event whose name is not a Signet event name. */
  | { readonly kind: 'unrecognised'; readonly source: IndexedSignetMiscEvent }
  /** A Signet event whose payload did not decode. */
  | {
      readonly kind: 'undecodable'
      readonly source: IndexedSignetMiscEvent
      readonly reason: string
    }

/** Decodes one streamed Signet event into the stored form. Failures are variants. */
export function decodeSignetContractEvent(source: IndexedSignetMiscEvent): SignetContractEvent {
  const result = tryDecodeSignetEvent(source)
  if (result === undefined) {
    return { kind: 'unrecognised', source }
  }
  return result.ok
    ? { ...result.event, kind: 'decoded' }
    : { kind: 'undecodable', source: result.source, reason: result.reason }
}
