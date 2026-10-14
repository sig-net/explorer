import { parseRequestIdHex, type SignBidirectionalNotification } from '@sig-net/midnight'
import { expect, test } from 'vitest'

import { signBidirectionalEventJson } from './sign-bidirectional-event-json'
import { inspectSignBidirectionalTransaction } from './sign-bidirectional-transaction-inspection'
import { SUBMIT_NATIVE_RAW_TRANSACTION_HEX } from './sign-bidirectional-transaction-inspection.fixture'

const REQUEST_ID = parseRequestIdHex(
  'af63798d599c4778b1bf06482d43235471399aaf1a5b0164f25f2e095c409900',
)
const CALLER = '0e64b7f804ee4985111d7d6ca94e48b71f78d3dc4dadacadadde0e8d3ac74f50'
const SIGNET = '49605c93a7f602bd3c4750f013615ee3e4bd4be02a201b051c2c220ece6a32f5'
const NOTIFICATION: SignBidirectionalNotification = {
  version: 1,
  callerAddress: CALLER,
  requestsPath: [0],
}

test('the call chain nests the claimed signet call under the top level call', () => {
  const { callChains } = inspectSignBidirectionalTransaction(
    SUBMIT_NATIVE_RAW_TRANSACTION_HEX,
    REQUEST_ID,
    NOTIFICATION,
  )
  expect(callChains).toEqual([
    {
      entryPoint: 'submitNative',
      address: CALLER,
      fallible: false,
      calls: [{ entryPoint: 'signBidirectional', address: SIGNET, fallible: false, calls: [] }],
    },
  ])
})

test('the request is the record written at the requests path under the request id', () => {
  const { request } = inspectSignBidirectionalTransaction(
    SUBMIT_NATIVE_RAW_TRANSACTION_HEX,
    REQUEST_ID,
    NOTIFICATION,
  )
  expect(request && signBidirectionalEventJson(request)).toEqual({
    keyVersion: 1,
    sender: CALLER,
    path: 'c02f1c87888df99ac48a01fbdbbca0715b2ca051ed85c8dfbaad0a0808b04617',
    algo: 0,
    txParamType: 0,
    txParams: {
      chainId: 11155111,
      nonce: 7,
      maxPriorityFeePerGas: 1582787,
      maxFeePerGas: 1582817,
      gasLimit: 14400,
      to: '2ec1b0f2e155982e1de09e9cb05e2ec758c51db8',
      value: 0,
      calldata: null,
      accessListEntryCount: 0,
      accessList: [],
    },
    executionDest: 'eip155:1',
    signatureDest: 0,
    params: '00'.repeat(64),
    outputDeserializationSchema: '[]',
    respondSerializationSchema: '',
  })
})

test('no request is found at another path or under another request id', () => {
  expect(
    inspectSignBidirectionalTransaction(SUBMIT_NATIVE_RAW_TRANSACTION_HEX, REQUEST_ID, {
      ...NOTIFICATION,
      requestsPath: [1],
    }).request,
  ).toBeNull()
  expect(
    inspectSignBidirectionalTransaction(
      SUBMIT_NATIVE_RAW_TRANSACTION_HEX,
      parseRequestIdHex('00'.repeat(32)),
      NOTIFICATION,
    ).request,
  ).toBeNull()
})
