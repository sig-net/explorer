import type { MidnightNetworkConfig } from '@/lib/midnight/network'

const ETHEREUM_MAINNET_CHAIN_ID = 1n
const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111n

/** The configured endpoint for an EVM chain, or null for a chain the configuration has none for. */
export function evmRpcUrl(
  config: Pick<MidnightNetworkConfig, 'ethereumMainnetRpcUrl' | 'ethereumSepoliaRpcUrl'>,
  chainId: bigint,
): string | null {
  const url =
    chainId === ETHEREUM_MAINNET_CHAIN_ID
      ? config.ethereumMainnetRpcUrl
      : chainId === ETHEREUM_SEPOLIA_CHAIN_ID
        ? config.ethereumSepoliaRpcUrl
        : ''
  return url.trim() === '' ? null : url.trim()
}

/** The signed transaction whose fate on its EVM chain is asked about. */
export interface EvmTransactionQuery {
  readonly hash: string
  /** The address the transaction is sent from. */
  readonly from: string
  readonly nonce: bigint
  readonly gasLimit: bigint
  readonly maxFeePerGas: bigint
  readonly value: bigint
}

/** A reason a node would not include the transaction if it were broadcast now. */
export type EvmSubmissionBlocker =
  /** The sender's next nonce is lower, so the transaction would wait for the ones before it. */
  | { readonly kind: 'nonce-gap'; readonly nextNonce: bigint }
  /** The sender cannot cover the gas limit at the maximum fee, plus the value. */
  | { readonly kind: 'insufficient-balance'; readonly balance: bigint; readonly required: bigint }
  /** The maximum fee is below the latest block's base fee, so the transaction would wait. */
  | { readonly kind: 'fee-below-base-fee'; readonly baseFeePerGas: bigint }

/** What one RPC node reports about a transaction. One node's view, never proof of absence. */
export type EvmTransactionStatus =
  | {
      readonly status: 'mined'
      /** False when the transaction was included and reverted. */
      readonly succeeded: boolean
      readonly blockNumber: number
      /** The block's timestamp: when the transaction was included, not when it was first sent. */
      readonly minedAt: Date
      /** Blocks from the transaction's block to the node's head, both included. */
      readonly confirmations: number
      /** True when the transaction's block is at or below the node's finalised block. */
      readonly finalised: boolean
    }
  /** Known to the node and waiting for inclusion. */
  | { readonly status: 'pending' }
  /** Unknown to the node, and the sender's nonce has passed it: another transaction took the nonce. */
  | { readonly status: 'nonce-used' }
  /** Unknown to the node. An empty `blockers` means it could still be broadcast and included. */
  | { readonly status: 'not-found'; readonly blockers: readonly EvmSubmissionBlocker[] }

async function rpcCall(
  rpcUrl: string,
  method: string,
  params: readonly (string | boolean)[],
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

/** A JSON-RPC quantity (`0x`-prefixed hex) as a bigint. */
function quantity(value: unknown, what: string): bigint {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/iu.test(value)) {
    throw new Error(`the RPC node returned no ${what}`)
  }
  return BigInt(value)
}

/** The named quantity field of a JSON-RPC object result. */
function quantityField(value: object, field: string): bigint {
  const record: Record<string, unknown> = { ...value }
  return quantity(record[field], field)
}

/**
 * Asks one RPC node what became of a signed transaction.
 *
 * @throws {Error} When the node cannot be reached, refuses a call or returns a malformed response.
 */
export async function fetchEvmTransactionStatus(
  rpcUrl: string,
  { hash, from, nonce, gasLimit, maxFeePerGas, value }: EvmTransactionQuery,
): Promise<EvmTransactionStatus> {
  const receipt = await rpcCall(rpcUrl, 'eth_getTransactionReceipt', [hash])
  if (typeof receipt === 'object' && receipt !== null) {
    const blockNumber = quantityField(receipt, 'blockNumber')
    const [head, finalisedBlock, block] = await Promise.all([
      rpcCall(rpcUrl, 'eth_blockNumber', []),
      rpcCall(rpcUrl, 'eth_getBlockByNumber', ['finalized', false]),
      rpcCall(rpcUrl, 'eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, false]),
    ])
    if (typeof block !== 'object' || block === null) {
      throw new Error("the RPC node returned no block for the transaction's receipt")
    }
    const finalisedNumber =
      typeof finalisedBlock === 'object' && finalisedBlock !== null
        ? quantityField(finalisedBlock, 'number')
        : null
    return {
      status: 'mined',
      succeeded: quantityField(receipt, 'status') === 1n,
      blockNumber: Number(blockNumber),
      minedAt: new Date(Number(quantityField(block, 'timestamp')) * 1000),
      confirmations: Number(quantity(head, 'head block number') - blockNumber + 1n),
      finalised: finalisedNumber !== null && blockNumber <= finalisedNumber,
    }
  }
  const [transaction, sentCount] = await Promise.all([
    rpcCall(rpcUrl, 'eth_getTransactionByHash', [hash]),
    rpcCall(rpcUrl, 'eth_getTransactionCount', [from, 'latest']),
  ])
  if (typeof transaction === 'object' && transaction !== null) {
    return { status: 'pending' }
  }
  const nextNonce = quantity(sentCount, 'transaction count')
  if (nextNonce > nonce) {
    return { status: 'nonce-used' }
  }
  const [rawBalance, latestBlock] = await Promise.all([
    rpcCall(rpcUrl, 'eth_getBalance', [from, 'latest']),
    rpcCall(rpcUrl, 'eth_getBlockByNumber', ['latest', false]),
  ])
  if (typeof latestBlock !== 'object' || latestBlock === null) {
    throw new Error('the RPC node returned no latest block')
  }
  const balance = quantity(rawBalance, 'balance')
  const required = gasLimit * maxFeePerGas + value
  const baseFeePerGas = quantityField(latestBlock, 'baseFeePerGas')
  const blockers: EvmSubmissionBlocker[] = []
  if (nextNonce < nonce) {
    blockers.push({ kind: 'nonce-gap', nextNonce })
  }
  if (balance < required) {
    blockers.push({ kind: 'insufficient-balance', balance, required })
  }
  if (maxFeePerGas < baseFeePerGas) {
    blockers.push({ kind: 'fee-below-base-fee', baseFeePerGas })
  }
  return { status: 'not-found', blockers }
}
