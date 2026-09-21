import { evmRpcCall } from '@/lib/midnight/evm-json-rpc'

/** The return data of a mined transaction's top call, as `0x` hex. */
export interface EvmTransactionOutput {
  readonly output: string
  /** True when the top call failed, so `output` is its revert data. */
  readonly reverted: boolean
}

/**
 * Reads a mined transaction's return data with `debug_traceTransaction`, the method the MPC observes
 * executions with. Hosted nodes often gate it behind a paid tier.
 *
 * @throws {Error} When the node cannot be reached, refuses the method, does not know the
 *   transaction or returns a malformed trace.
 */
async function fetchEvmTransactionOutput(
  rpcUrl: string,
  hash: string,
): Promise<EvmTransactionOutput> {
  const trace = await evmRpcCall(rpcUrl, 'debug_traceTransaction', [
    hash,
    { tracer: 'callTracer', tracerConfig: { onlyTopCall: true } },
  ])
  if (typeof trace !== 'object' || trace === null) {
    throw new Error('the RPC node returned no trace')
  }
  const frame: Record<string, unknown> = { ...trace }
  // A call that returns nothing has no `output` field.
  const output = frame.output ?? '0x'
  if (typeof output !== 'string' || !/^0x([0-9a-f]{2})*$/iu.test(output)) {
    throw new Error('the RPC node returned a trace with a malformed output')
  }
  return { output, reverted: typeof frame.error === 'string' }
}

const outputs = new Map<string, Promise<EvmTransactionOutput>>()

/**
 * {@link fetchEvmTransactionOutput}, once per node and transaction: a mined transaction's return
 * data never changes, so every later call shares the first result. A failed read is forgotten, so
 * the next call retries.
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
