import { type EvmTraceOutput, evmTraceOutputFromCallFrame, type JsonValue } from '@sig-net/midnight'

import { evmRpcCall } from '@/lib/midnight/evm-json-rpc'

/** What a mined transaction's top call frame yields, read by the MPC's rules. */
export type EvmTransactionOutput =
  | { readonly status: 'read'; readonly trace: EvmTraceOutput }
  /** A frame the MPC reads no return data from: the call errored, or the frame is malformed. */
  | { readonly status: 'unreadable'; readonly reason: string }

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue)
  }
  return typeof value === 'object' && Object.values(value).every(isJsonValue)
}

/**
 * Reads a mined transaction's top call frame with `debug_traceTransaction`, the method the MPC
 * observes executions with. Hosted nodes often gate it behind a paid tier.
 *
 * @throws {Error} When the node cannot be reached, refuses the method, does not know the
 *   transaction or returns no trace.
 */
async function fetchEvmTransactionOutput(
  rpcUrl: string,
  hash: string,
): Promise<EvmTransactionOutput> {
  const frame = await evmRpcCall(rpcUrl, 'debug_traceTransaction', [
    hash,
    { tracer: 'callTracer', tracerConfig: { onlyTopCall: true } },
  ])
  if (frame === null || frame === undefined || !isJsonValue(frame)) {
    throw new Error('the RPC node returned no trace')
  }
  try {
    return { status: 'read', trace: evmTraceOutputFromCallFrame(frame) }
  } catch (error) {
    return { status: 'unreadable', reason: error instanceof Error ? error.message : String(error) }
  }
}

const outputs = new Map<string, Promise<EvmTransactionOutput>>()

/**
 * {@link fetchEvmTransactionOutput}, once per node and transaction: a mined transaction's trace
 * never changes, so every later call shares the first result. A failed read is forgotten, so the
 * next call retries.
 */
export function loadEvmTransactionOutput(
  rpcUrl: string,
  hash: string,
): Promise<EvmTransactionOutput> {
  const key = JSON.stringify([rpcUrl, hash])
  let output = outputs.get(key)
  if (output === undefined) {
    output = fetchEvmTransactionOutput(rpcUrl, hash)
    output.catch(() => outputs.delete(key))
    outputs.set(key, output)
  }
  return output
}
