import { bytesToHex, type EvmType2TxParams, type SignBidirectionalEvent } from '@sig-net/midnight'

/** A Compact unsigned integer as JSON: a number while it is exactly representable, else a string. */
type JsonInteger = number | string

/** A {@link SignBidirectionalEvent} as plain JSON: bytes as hex, text fields as text. */
export interface SignBidirectionalEventJson {
  sender: string
  requestNonce: JsonInteger
  keyVersion: JsonInteger
  path: string
  algo: number
  dest: number
  params: string
  txParamType: number
  txParams: {
    chainId: JsonInteger
    nonce: JsonInteger
    maxPriorityFeePerGas: JsonInteger
    maxFeePerGas: JsonInteger
    gasLimit: JsonInteger
    to: string
    value: JsonInteger
    calldata: { selector: string; noWords: JsonInteger; words: string[] } | null
    accessListEntryCount: JsonInteger
    accessList: { address: string; storageKeyCount: JsonInteger; storageKeys: string[] }[]
  }
  caip2Id: string
  outputDeserializationSchema: string
  respondSerializationSchema: string
}

function jsonInteger(value: bigint): JsonInteger {
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString()
}

/** The bytes as UTF-8 text without their NUL padding, or as hex when they are not text. */
function textOrHex(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\0+$/u, '')
  } catch {
    return bytesToHex(bytes)
  }
}

function txParamsJson(txParams: EvmType2TxParams): SignBidirectionalEventJson['txParams'] {
  return {
    chainId: jsonInteger(txParams.chainId),
    nonce: jsonInteger(txParams.nonce),
    maxPriorityFeePerGas: jsonInteger(txParams.maxPriorityFeePerGas),
    maxFeePerGas: jsonInteger(txParams.maxFeePerGas),
    gasLimit: jsonInteger(txParams.gasLimit),
    to: bytesToHex(txParams.to),
    value: jsonInteger(txParams.value),
    calldata: txParams.calldata.is_some
      ? {
          selector: bytesToHex(txParams.calldata.value.selector),
          noWords: jsonInteger(txParams.calldata.value.noWords),
          words: txParams.calldata.value.words.map(bytesToHex),
        }
      : null,
    accessListEntryCount: jsonInteger(txParams.accessListEntryCount),
    accessList: txParams.accessList.map((entry) => ({
      address: bytesToHex(entry.address),
      storageKeyCount: jsonInteger(entry.storageKeyCount),
      storageKeys: entry.storageKeys.map(bytesToHex),
    })),
  }
}

export function signBidirectionalEventJson(
  event: SignBidirectionalEvent,
): SignBidirectionalEventJson {
  return {
    sender: bytesToHex(event.sender.bytes),
    requestNonce: jsonInteger(event.requestNonce),
    keyVersion: jsonInteger(event.keyVersion),
    path: bytesToHex(event.path),
    algo: event.algo,
    dest: event.dest,
    params: bytesToHex(event.params),
    txParamType: event.txParamType,
    txParams: txParamsJson(event.txParams),
    caip2Id: textOrHex(event.caip2Id),
    outputDeserializationSchema: textOrHex(event.outputDeserializationSchema),
    respondSerializationSchema: textOrHex(event.respondSerializationSchema),
  }
}
