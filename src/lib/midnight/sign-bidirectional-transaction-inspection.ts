// This module statically imports the Midnight ledger WebAssembly. Load it with a dynamic
// `import()` only, and import its types with `import type`.
import {
  type AlignedValue,
  type ContractCall,
  entryPointHash,
  type Op,
  type Proofish,
  Transaction,
  type Transcript,
} from '@midnightntwrk/ledger-v9'
import {
  decodeEvmType2SignBidirectionalEvent,
  hexToBytes,
  type RequestIdHex,
  type SignBidirectionalEvent,
  type SignBidirectionalNotification,
  TxParamType,
} from '@sig-net/midnight'

/** One contract call of a transaction, with the calls its transcripts claim it made. */
export interface ContractCallNode {
  readonly entryPoint: string
  readonly address: string
  /**
   * Whether any of the call's program runs in the transaction's fallible section. The MPC reads
   * guaranteed transcripts only, so it skips a Signet call this is true for.
   */
  readonly fallible: boolean
  readonly calls: readonly ContractCallNode[]
}

export interface SignBidirectionalTransactionInspection {
  /** The transaction's top level calls, in transaction order, each the root of its call chain. */
  readonly callChains: readonly ContractCallNode[]
  /**
   * The request record the caller's transcript writes at the notified requests path under the
   * request id, or null when the transaction holds no such write.
   */
  readonly request: SignBidirectionalEvent | null
}

type Call = ContractCall<Proofish>

function entryPointName(call: Call): string {
  return typeof call.entryPoint === 'string'
    ? call.entryPoint
    : new TextDecoder().decode(call.entryPoint)
}

function transcriptsOf(call: Call): Transcript<AlignedValue>[] {
  return [call.guaranteedTranscript, call.fallibleTranscript].flatMap((transcript) =>
    transcript === undefined ? [] : [transcript],
  )
}

function bytesHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * The calls among `calls` that `caller` claims. A claim names the callee's address, the hash of
 * its entry point and the communication commitment the callee carries.
 */
function claimedCalls(caller: Call, calls: readonly Call[]): Call[] {
  return transcriptsOf(caller).flatMap((transcript) =>
    transcript.effects.claimedContractCalls.flatMap(
      ([, address, claimedEntryPointHash, commitment]) =>
        calls.filter(
          (candidate) =>
            candidate !== caller &&
            candidate.address === address &&
            entryPointHash(candidate.entryPoint) === claimedEntryPointHash &&
            candidate.communicationCommitment === bytesHex(commitment),
        ),
    ),
  )
}

function callChains(calls: readonly Call[]): ContractCallNode[] {
  const claimed = new Map(calls.map((call) => [call, claimedCalls(call, calls)]))
  const callees = new Set(Array.from(claimed.values()).flat())
  // `ancestors` stops a malformed transaction whose claims form a cycle from recursing forever.
  const node = (call: Call, ancestors: readonly Call[]): ContractCallNode => ({
    entryPoint: entryPointName(call),
    address: call.address,
    fallible: call.fallibleTranscript !== undefined,
    calls: (claimed.get(call) ?? [])
      .filter((callee) => !ancestors.includes(callee))
      .map((callee) => node(callee, [...ancestors, call])),
  })
  return calls.filter((call) => !callees.has(call)).map((call) => node(call, [call]))
}

/** The ledger trims an atom's trailing zero bytes, so the path index 0 is an empty atom. */
function pathIndexes(op: Extract<Op<AlignedValue>, { idx: object }>): (number | null)[] {
  return op.idx.path.map((key) => (key.tag === 'value' ? (key.value.value[0]?.[0] ?? 0) : null))
}

function isIdx(op: Op<AlignedValue> | undefined): op is Extract<Op<AlignedValue>, { idx: object }> {
  return typeof op === 'object' && 'idx' in op
}

function pushOf(
  op: Op<AlignedValue> | undefined,
): Extract<Op<AlignedValue>, { push: object }>['push'] | null {
  return typeof op === 'object' && 'push' in op ? op.push : null
}

/**
 * The record a transcript inserts into the map at `path` under `requestId`. A Compact map insert
 * compiles to `idx(pushPath, path)`, `push(key)`, `push(storage value)`, `ins`.
 */
function requestCellWrittenAt(
  transcript: Transcript<AlignedValue>,
  path: readonly number[],
  requestId: Uint8Array,
): AlignedValue | null {
  const ops = transcript.program
  for (const [at, op] of ops.entries()) {
    const key = pushOf(ops[at + 1])
    const value = pushOf(ops[at + 2])
    const insert = ops[at + 3]
    if (
      !isIdx(op) ||
      !op.idx.pushPath ||
      pathIndexes(op).join() !== path.join() ||
      key?.value.tag !== 'cell' ||
      value?.value.tag !== 'cell' ||
      !value.storage ||
      typeof insert !== 'object' ||
      !('ins' in insert)
    ) {
      continue
    }
    const keyAtom = key.value.content.value[0] ?? new Uint8Array()
    // The key's trailing zero bytes are trimmed, so the request id matches when every byte the
    // key holds equals the id's and every byte past the key's end is zero.
    if (requestId.every((byte, index) => byte === (keyAtom[index] ?? 0))) {
      return value.value.content
    }
  }
  return null
}

/**
 * Reads a sign bidirectional transaction's call chains and the request record it stores, from the
 * transaction's own bytes.
 *
 * @throws {Error} When the bytes do not deserialise, or the stored record does not decode.
 */
export function inspectSignBidirectionalTransaction(
  rawTransactionHex: string,
  requestId: RequestIdHex,
  notification: SignBidirectionalNotification,
): SignBidirectionalTransactionInspection {
  const transaction = Transaction.deserialize(
    'signature',
    'proof',
    'binding',
    hexToBytes(rawTransactionHex),
  )
  const calls = Array.from(transaction.intents?.values() ?? []).flatMap((intent) =>
    intent.actions.flatMap((action) => ('entryPoint' in action ? [action] : [])),
  )
  const requestIdBytes = hexToBytes(requestId)
  const cell =
    calls
      .filter((call) => call.address === notification.callerAddress)
      .flatMap(transcriptsOf)
      .map((transcript) =>
        requestCellWrittenAt(transcript, notification.requestsPath, requestIdBytes),
      )
      .find((written) => written !== null) ?? null
  let request: SignBidirectionalEvent | null = null
  if (cell !== null) {
    request = decodeEvmType2SignBidirectionalEvent(cell, 'the request record in the transcript')
    if (request.txParamType !== TxParamType.evmType2) {
      throw new Error(`unsupported txParamType ${String(request.txParamType)}`)
    }
  }
  return { callChains: callChains(calls), request }
}
