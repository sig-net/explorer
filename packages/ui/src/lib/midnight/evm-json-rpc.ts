export type EvmRpcParam = string | boolean | { readonly [key: string]: EvmRpcParam }

/**
 * One JSON-RPC call to an EVM node, answering its `result`, or null when the node sends none.
 *
 * @throws {Error} When the node cannot be reached, answers a failure status or refuses the call.
 */
export async function evmRpcCall(
  rpcUrl: string,
  method: string,
  params: readonly EvmRpcParam[],
): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!response.ok) {
    throw new Error(`the RPC node answered ${String(response.status)}`)
  }
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null) {
    throw new Error('the RPC node returned no JSON-RPC response')
  }
  if ('error' in body && body.error !== null && body.error !== undefined) {
    const { error } = body
    const message =
      typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'an error'
    throw new Error(`the RPC node refused ${method}: ${message}`)
  }
  return 'result' in body ? body.result : null
}
