import { EvmTraceOutputKind } from '@sig-net/midnight'
import { afterEach, expect, test, vi } from 'vitest'

import { loadEvmTransactionOutput } from './evm-transaction-output'

const RPC_URL = 'https://rpc.example'

function stubRpcNode(body: object): { calls: () => number } {
  let calls = 0
  vi.stubGlobal('fetch', () => {
    calls += 1
    return Promise.resolve(Response.json({ jsonrpc: '2.0', id: 1, ...body }))
  })
  return { calls: () => calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('the top call`s return data is read once per node and transaction', async () => {
  const node = stubRpcNode({ result: { type: 'CALL', output: '0x01' } })
  expect(await loadEvmTransactionOutput(RPC_URL, '0xa1')).toEqual({
    status: 'read',
    trace: { kind: EvmTraceOutputKind.Output, returnData: new Uint8Array([1]) },
  })
  await loadEvmTransactionOutput(RPC_URL, '0xa1')
  expect(node.calls()).toBe(1)
})

test('a call that returns nothing carries no return data', async () => {
  stubRpcNode({ result: { type: 'CALL' } })
  expect(await loadEvmTransactionOutput(RPC_URL, '0xb1')).toEqual({
    status: 'read',
    trace: { kind: EvmTraceOutputKind.NoReturnData },
  })
})

test('a failed call and a malformed frame are unreadable, with the reason', async () => {
  stubRpcNode({ result: { type: 'CALL', output: '0x08c379a0', error: 'execution reverted' } })
  expect(await loadEvmTransactionOutput(RPC_URL, '0xb2')).toEqual({
    status: 'unreadable',
    reason: expect.stringContaining('execution reverted'),
  })
  stubRpcNode({ result: { output: '0x01' } })
  expect(await loadEvmTransactionOutput(RPC_URL, '0xb3')).toEqual({
    status: 'unreadable',
    reason: expect.stringContaining('no call frame `type`'),
  })
})

test('a gated method rejects with the node`s message, and the next call retries', async () => {
  stubRpcNode({ error: { code: -32601, message: 'method not available' } })
  await expect(loadEvmTransactionOutput(RPC_URL, '0xc1')).rejects.toThrow('method not available')
  stubRpcNode({ result: { type: 'CALL', output: '0x01' } })
  expect(await loadEvmTransactionOutput(RPC_URL, '0xc1')).toMatchObject({ status: 'read' })
})

test('a node that returns no trace rejects', async () => {
  stubRpcNode({ result: null })
  await expect(loadEvmTransactionOutput(RPC_URL, '0xd1')).rejects.toThrow('no trace')
})
