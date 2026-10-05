import { parseRequestIdHex, type SignBidirectionalNotification } from '@sig-net/midnight'
import { expect, test } from 'vitest'

import { signBidirectionalEventJson } from './sign-bidirectional-event-json'
import { inspectSignBidirectionalTransaction } from './sign-bidirectional-transaction-inspection'
import { SEND_DEPOSIT_RAW_TRANSACTION_HEX } from './sign-bidirectional-transaction-inspection.fixture'

const REQUEST_ID = parseRequestIdHex(
  '6fcfb0b2bc97d03961d5dd7f062408800a9d0844e083156a13283f2dd5051800',
)
const CALLER = '6d72911f7f14ff750be043ec62b9e4342cd9ebd3894bcb242d3902edc58d9a00'
const SIGNET = '838778d20f63f5e9ffebc95f6bdc48b8ed8c478e191eba6aab82447f6eed1baa'
const NOTIFICATION: SignBidirectionalNotification = {
  version: 1,
  callerAddress: CALLER,
  requestsPath: [2, 5],
}

test('the call chain nests the claimed signet call under the top level call, and flags the fallible section', () => {
  const { callChains } = inspectSignBidirectionalTransaction(
    SEND_DEPOSIT_RAW_TRANSACTION_HEX,
    REQUEST_ID,
    NOTIFICATION,
  )
  expect(callChains).toEqual([
    {
      entryPoint: 'sendDeposit',
      address: CALLER,
      fallible: true,
      calls: [{ entryPoint: 'signBidirectional', address: SIGNET, fallible: true, calls: [] }],
    },
  ])
})

test('the request is the record written at the requests path under the request id', () => {
  const { request } = inspectSignBidirectionalTransaction(
    SEND_DEPOSIT_RAW_TRANSACTION_HEX,
    REQUEST_ID,
    NOTIFICATION,
  )
  expect(request && signBidirectionalEventJson(request)).toEqual({
    keyVersion: 1,
    sender: CALLER,
    path: '7ee08daa234fd7e5760485df51800e9978624ec222cdb834a8caa0531b946d00',
    algo: 0,
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
          '000000000000000000000000420a9a212b2b8afd908ce63074451a6f2456fa82',
          '00000000000000000000000000000000000000000000000000000000000186a0',
        ],
      },
      accessListEntryCount: 0,
      accessList: [],
    },
    executionDest: 'eip155:1',
    signatureDest: 0,
    params: '00'.repeat(64),
    outputDeserializationSchema: '[{"name":"success","type":"bool"}]',
    respondSerializationSchema: '',
  })
})

test('no request is found at another path or under another request id', () => {
  expect(
    inspectSignBidirectionalTransaction(SEND_DEPOSIT_RAW_TRANSACTION_HEX, REQUEST_ID, {
      ...NOTIFICATION,
      requestsPath: [2, 4],
    }).request,
  ).toBeNull()
  expect(
    inspectSignBidirectionalTransaction(
      SEND_DEPOSIT_RAW_TRANSACTION_HEX,
      parseRequestIdHex('00'.repeat(32)),
      NOTIFICATION,
    ).request,
  ).toBeNull()
})
