import { evmRpcCall } from '@/lib/midnight/evm-json-rpc'
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
      /** `unknown` when the node holds the transaction and has pruned its receipt. */
      readonly outcome: 'succeeded' | 'reverted' | 'unknown'
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

type MinedEvmTransactionStatus = Extract<EvmTransactionStatus, { status: 'mined' }>

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

async function minedStatus(
  rpcUrl: string,
  blockNumber: bigint,
  outcome: MinedEvmTransactionStatus['outcome'],
): Promise<MinedEvmTransactionStatus> {
  const [head, finalisedBlock, block] = await Promise.all([
    evmRpcCall(rpcUrl, 'eth_blockNumber', []),
    evmRpcCall(rpcUrl, 'eth_getBlockByNumber', ['finalized', false]),
    evmRpcCall(rpcUrl, 'eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, false]),
  ])
  if (typeof block !== 'object' || block === null) {
    throw new Error("the RPC node returned no block for the transaction's block number")
  }
  const finalisedNumber =
    typeof finalisedBlock === 'object' && finalisedBlock !== null
      ? quantityField(finalisedBlock, 'number')
      : null
  return {
    status: 'mined',
    outcome,
    blockNumber: Number(blockNumber),
    minedAt: new Date(Number(quantityField(block, 'timestamp')) * 1000),
    confirmations: Number(quantity(head, 'head block number') - blockNumber + 1n),
    finalised: finalisedNumber !== null && blockNumber <= finalisedNumber,
  }
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
  const receipt = await evmRpcCall(rpcUrl, 'eth_getTransactionReceipt', [hash])
  if (typeof receipt === 'object' && receipt !== null) {
    return minedStatus(
      rpcUrl,
      quantityField(receipt, 'blockNumber'),
      quantityField(receipt, 'status') === 1n ? 'succeeded' : 'reverted',
    )
  }
  const [transaction, sentCount] = await Promise.all([
    evmRpcCall(rpcUrl, 'eth_getTransactionByHash', [hash]),
    evmRpcCall(rpcUrl, 'eth_getTransactionCount', [from, 'latest']),
  ])
  if (typeof transaction === 'object' && transaction !== null) {
    // A node that prunes old receipts still serves the transaction, with the block it is in.
    const record: Record<string, unknown> = { ...transaction }
    return record.blockNumber === null || record.blockNumber === undefined
      ? { status: 'pending' }
      : minedStatus(rpcUrl, quantityField(transaction, 'blockNumber'), 'unknown')
  }
  const nextNonce = quantity(sentCount, 'transaction count')
  if (nextNonce > nonce) {
    return { status: 'nonce-used' }
  }
  const [rawBalance, latestBlock] = await Promise.all([
    evmRpcCall(rpcUrl, 'eth_getBalance', [from, 'latest']),
    evmRpcCall(rpcUrl, 'eth_getBlockByNumber', ['latest', false]),
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
