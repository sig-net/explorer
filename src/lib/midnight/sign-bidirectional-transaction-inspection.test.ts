import { parseRequestIdHex, type SignBidirectionalNotification } from '@sig-net/midnight'
import { expect, test } from 'vitest'

import { signBidirectionalEventJson } from './sign-bidirectional-event-json'
import { inspectSignBidirectionalTransaction } from './sign-bidirectional-transaction-inspection'
import { START_DEPOSIT_RAW_TRANSACTION_HEX } from './sign-bidirectional-transaction-inspection.fixture'

const REQUEST_ID = parseRequestIdHex(
  'af95a7c83af12c495d457f8b7f322db1e4d9f9b54ae294164cf828da8d2aa100',
)
const VAULT = 'f8ea9475479adc86e9e4a98f1cda5c1ad8411047c61d6f93b0c5b589ecdb3b17'
const SIGNET = '1df4ce25fc9f9c03dc6f4d0eb12ddf3d0db094995d4c70aca1142eebb3b77a5d'
const NOTIFICATION: SignBidirectionalNotification = {
  version: 1,
  callerAddress: VAULT,
  requestsPath: [1, 3],
}

test('the call chain nests the claimed signet call under the top level call', () => {
  const { callChains } = inspectSignBidirectionalTransaction(
    START_DEPOSIT_RAW_TRANSACTION_HEX,
    REQUEST_ID,
    NOTIFICATION,
  )
  expect(callChains).toEqual([
    {
      entryPoint: 'startDeposit',
      address: VAULT,
      calls: [{ entryPoint: 'signBidirectional', address: SIGNET, calls: [] }],
    },
  ])
})

test('the request is the record written at the requests path under the request id', () => {
  const { request } = inspectSignBidirectionalTransaction(
    START_DEPOSIT_RAW_TRANSACTION_HEX,
    REQUEST_ID,
    NOTIFICATION,
  )
  expect(request && signBidirectionalEventJson(request)).toEqual({
    sender: VAULT,
    requestNonce: 1,
    keyVersion: 1,
    path: 'cd89a13a47228126d87c29ebc7eede5753f13d2cc633eda13db39b1a9943d200',
    algo: 0,
    dest: 0,
    params: '00'.repeat(64),
    txParamType: 0,
    txParams: {
      chainId: 11155111,
      nonce: 0,
      maxPriorityFeePerGas: 1000000000,
      maxFeePerGas: 30000000000,
      gasLimit: 100000,
      to: '1c7d4b196cb0c7b01d743fbc6116a902379c7238',
      value: 0,
      calldata: {
        selector: 'a9059cbb',
        noWords: 2,
        words: [
          '000000000000000000000000493bd202a82841f4969b6955884b142ae6e0b23d',
          '00000000000000000000000000000000000000000000000000000000000186a0',
        ],
      },
      accessListEntryCount: 0,
      accessList: [],
    },
    caip2Id: 'eip155:1',
    outputDeserializationSchema: '[{"name":"success","type":"bool"}]',
    respondSerializationSchema: '[{"name":"success","type":"bool"}]',
  })
})

test('no request is found at another path or under another request id', () => {
  expect(
    inspectSignBidirectionalTransaction(START_DEPOSIT_RAW_TRANSACTION_HEX, REQUEST_ID, {
      ...NOTIFICATION,
      requestsPath: [1, 2],
    }).request,
  ).toBeNull()
  expect(
    inspectSignBidirectionalTransaction(
      START_DEPOSIT_RAW_TRANSACTION_HEX,
      parseRequestIdHex('00'.repeat(32)),
      NOTIFICATION,
    ).request,
  ).toBeNull()
})
