import {
  type AlignedValue,
  type ContractCall,
  entryPointHash,
  type Op,
  type Proofish,
  Transaction,
  type Transcript,
} from '@midnightntwrk/ledger-v9'
import type { ContractCallNode, RequestCellWire } from '@sig-net/explorer-api'
import type { SignBidirectionalLifecycle } from '@sig-net/explorer-lib'
import {
  bytesToHex,
  decodeEvmType2SignBidirectionalEvent,
  hexToBytes,
  TxParamType,
} from '@sig-net/midnight'

import type { StoredInspection } from '../db/schema.ts'

/**
 * Reads a transaction's call chains and, under the id of each of `notifications`, the request cell
 * its caller's transcript wrote at the notified requests path under the request id. A failure to
 * read the transaction fails the whole inspection, a failure to read one notification's cell fails
 * that entry alone. It never throws.
 */
export function inspectTransactionForStorage(
  rawTransactionHex: string,
  notifications: readonly InspectedNotification[],
): StoredInspection {
  let calls: Call[]
  let chains: ContractCallNode[]
  try {
    const transaction = Transaction.deserialize(
      'signature',
      'proof',
      'binding',
      hexToBytes(rawTransactionHex),
    )
    calls = Array.from(transaction.intents?.values() ?? []).flatMap((intent) =>
      intent.actions.flatMap((action) => ('entryPoint' in action ? [action] : [])),
    )
    chains = callChains(calls)
  } catch (error) {
    return { failed: reasonOf(error) }
  }
  const requests: Record<string, { cell: RequestCellWire | null } | { failed: string }> = {}
  for (const notification of notifications) {
    let entry: { cell: RequestCellWire | null } | { failed: string }
    try {
      entry = { cell: requestCellOf(calls, notification) }
    } catch (error) {
      entry = { failed: reasonOf(error) }
    }
    requests[String(notification.source.id)] = entry
  }
  return { callChains: chains, requests }
}

/** A decoded sign bidirectional event, whose transaction the inspection reads. */
type InspectedNotification = SignBidirectionalLifecycle['signBidirectionalEvents'][number]

type Call = ContractCall<Proofish>

/**
 * The request cell `notification` points at, in its wire form.
 *
 * @throws {Error} When the cell is not a decodable evmType2 request record.
 */
function requestCellOf(
  calls: readonly Call[],
  { requestId, record }: InspectedNotification,
): RequestCellWire | null {
  const requestIdBytes = hexToBytes(requestId)
  const cell =
    calls
      .filter((call) => call.address === record.callerAddress)
      .flatMap(transcriptsOf)
      .map((transcript) => requestCellWrittenAt(transcript, record.requestsPath, requestIdBytes))
      .find((written) => written !== null) ?? null
  if (cell === null) {
    return null
  }
  const request = decodeEvmType2SignBidirectionalEvent(cell, 'the request record in the transcript')
  if (request.txParamType !== TxParamType.evmType2) {
    throw new Error(`unsupported txParamType ${String(request.txParamType)}`)
  }
  return { value: cell.value.map((atom) => bytesToHex(atom)), alignment: cell.alignment }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

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
            candidate.communicationCommitment === bytesToHex(commitment),
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
