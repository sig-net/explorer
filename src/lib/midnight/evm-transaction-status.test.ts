import { afterEach, expect, test, vi } from 'vitest'

import { evmRpcUrl, fetchEvmTransactionStatus } from './evm-transaction-status'

const RPC_URL = 'https://rpc.example'
const QUERY = {
  hash: '0x84e8c369f283eb7ca26693d0db2092e121407d140a9a4657ac7780182f963f13',
  from: '0xCAE822d4c5858b5d8E3b648E008c0Af7577e7B59',
  nonce: 1n,
  gasLimit: 100n,
  maxFeePerGas: 10n,
  value: 5n,
}

type RpcResults = Readonly<Record<string, object | string | null>>

/**
 * Answers each JSON-RPC call with the `results` entry whose key names it, as a node's `result`. A
 * key is the method, optionally followed by a string parameter: `eth_getBlockByNumber finalized`.
 */
function stubRpcNode(results: RpcResults): void {
  vi.stubGlobal('fetch', (_url: string, init: { body: string }) => {
    const key = Object.keys(results).find((candidate) =>
      candidate.split(' ').every((part) => init.body.includes(`"${part}"`)),
    )
    const result = key === undefined ? null : (results[key] ?? null)
    return Promise.resolve(Response.json({ jsonrpc: '2.0', id: 1, result }))
  })
}

// 0x650c5f00 seconds is 2023-09-21T15:19:28Z.
const MINED_BLOCK = { 'eth_getBlockByNumber 0x64': { timestamp: '0x650c5f00' } }
const MINED_AT = new Date('2023-09-21T15:19:28Z')

afterEach(() => {
  vi.unstubAllGlobals()
})

interface StatusCase {
  name: string
  results: RpcResults
  expected: Awaited<ReturnType<typeof fetchEvmTransactionStatus>>
}

const CASES: StatusCase[] = [
  {
    name: 'a finalised success counts blocks up to the head, both ends included',
    results: {
      eth_getTransactionReceipt: { status: '0x1', blockNumber: '0x64' },
      eth_blockNumber: '0x6e',
      'eth_getBlockByNumber finalized': { number: '0x64' },
      ...MINED_BLOCK,
    },
    expected: {
      status: 'mined',
      succeeded: true,
      blockNumber: 100,
      minedAt: MINED_AT,
      confirmations: 11,
      finalised: true,
    },
  },
  {
    name: 'a revert above the finalised block is mined, failed and not final',
    results: {
      eth_getTransactionReceipt: { status: '0x0', blockNumber: '0x64' },
      eth_blockNumber: '0x64',
      'eth_getBlockByNumber finalized': { number: '0x63' },
      ...MINED_BLOCK,
    },
    expected: {
      status: 'mined',
      succeeded: false,
      blockNumber: 100,
      minedAt: MINED_AT,
      confirmations: 1,
      finalised: false,
    },
  },
  {
    name: 'a node with no finalised block reports not final',
    results: {
      eth_getTransactionReceipt: { status: '0x1', blockNumber: '0x64' },
      eth_blockNumber: '0x65',
      ...MINED_BLOCK,
    },
    expected: {
      status: 'mined',
      succeeded: true,
      blockNumber: 100,
      minedAt: MINED_AT,
      confirmations: 2,
      finalised: false,
    },
  },
  {
    name: 'a transaction the node holds without a receipt is pending',
    results: { eth_getTransactionByHash: { hash: QUERY.hash }, eth_getTransactionCount: '0x1' },
    expected: { status: 'pending' },
  },
  {
    name: 'an unknown transaction whose nonce the sender has passed lost its nonce',
    results: { eth_getTransactionCount: '0x2' },
    expected: { status: 'nonce-used' },
  },
  {
    // The transaction needs 100 gas at 10 wei plus 5 wei of value: 1005 wei (0x3ed).
    name: 'an unknown transaction the sender can still afford at its next nonce has no blockers',
    results: {
      eth_getTransactionCount: '0x1',
      eth_getBalance: '0x3ed',
      'eth_getBlockByNumber latest': { baseFeePerGas: '0xa' },
    },
    expected: { status: 'not-found', blockers: [] },
  },
  {
    name: 'an unknown transaction is blocked by a nonce gap, a short balance and a low fee',
    results: {
      eth_getTransactionCount: '0x0',
      eth_getBalance: '0x3ec',
      'eth_getBlockByNumber latest': { baseFeePerGas: '0xb' },
    },
    expected: {
      status: 'not-found',
      blockers: [
        { kind: 'nonce-gap', nextNonce: 0n },
        { kind: 'insufficient-balance', balance: 1004n, required: 1005n },
        { kind: 'fee-below-base-fee', baseFeePerGas: 11n },
      ],
    },
  },
]

test.for(CASES)('$name', async ({ results, expected }) => {
  stubRpcNode(results)
  await expect(fetchEvmTransactionStatus(RPC_URL, QUERY)).resolves.toEqual(expected)
})

test('a JSON-RPC error rejects with the node`s message', async () => {
  vi.stubGlobal('fetch', () =>
    Promise.resolve(Response.json({ jsonrpc: '2.0', id: 1, error: { message: 'rate limited' } })),
  )
  await expect(fetchEvmTransactionStatus(RPC_URL, QUERY)).rejects.toThrow('rate limited')
})

test('an HTTP failure rejects', async () => {
  vi.stubGlobal('fetch', () => Promise.resolve(new Response('', { status: 503 })))
  await expect(fetchEvmTransactionStatus(RPC_URL, QUERY)).rejects.toThrow('503')
})

const RPC_CONFIG = {
  ethereumMainnetRpcUrl: 'https://mainnet.example',
  ethereumSepoliaRpcUrl: ' https://sepolia.example ',
}

test.for([
  [1n, 'https://mainnet.example'],
  [11155111n, 'https://sepolia.example'],
  [137n, null],
] as const)('chain %s uses %s', ([chainId, url]) => {
  expect(evmRpcUrl(RPC_CONFIG, chainId)).toBe(url)
})

test('a blank endpoint means no endpoint', () => {
  expect(evmRpcUrl({ ...RPC_CONFIG, ethereumMainnetRpcUrl: '  ' }, 1n)).toBeNull()
})
