import {
  bytesToHex,
  calculateRequestId,
  parseRequestIdHex,
  type SignBidirectionalNotification,
} from '@sig-net/midnight'
import { expect, test } from 'vitest'

import { signBidirectionalEventJson } from './sign-bidirectional-event-json'
import { inspectSignBidirectionalTransaction } from './sign-bidirectional-transaction-inspection'
import { SIGN_BIDIRECTIONAL_RAW_TRANSACTION_HEX } from './sign-bidirectional-transaction-inspection.fixture'

// The preprod signer the transaction calls.
const SIGNER = '798e602d58ca65bae159464f43091bd790b3ef23f10abb49d962bc0efeb00c5e'
// The Sign Bidirectional Event the transaction emitted on that signer, as decoded.
const REQUEST_ID = parseRequestIdHex(
  '54f6494883830237e14f8fe4e0cb14ec0c6b06046a5b8b42ffa8478564388300',
)
const CALLER = '4890aeb5fb2eaee7dafe6c87ca73d34807ce61b92d4542c1c82e2296e5e2a728'
const NOTIFICATION: SignBidirectionalNotification = {
  version: 1,
  callerAddress: CALLER,
  requestsPath: [2, 5],
}

test('the call chain nests the claimed signer call under the top level call', () => {
  const { callChains } = inspectSignBidirectionalTransaction(
    SIGN_BIDIRECTIONAL_RAW_TRANSACTION_HEX,
    REQUEST_ID,
    NOTIFICATION,
  )
  expect(callChains).toEqual([
    {
      entryPoint: 'sendDeposit',
      address: CALLER,
      fallible: true,
      calls: [
        {
          entryPoint: 'signBidirectional',
          address: SIGNER,
          fallible: true,
          calls: [],
        },
      ],
    },
  ])
})

test('the request record found hashes to the request id the event declares', () => {
  const { request } = inspectSignBidirectionalTransaction(
    SIGN_BIDIRECTIONAL_RAW_TRANSACTION_HEX,
    REQUEST_ID,
    NOTIFICATION,
  )
  expect(request && bytesToHex(calculateRequestId(request))).toBe(REQUEST_ID)
})

test('the request is the record written at the requests path under the request id', () => {
  const { request } = inspectSignBidirectionalTransaction(
    SIGN_BIDIRECTIONAL_RAW_TRANSACTION_HEX,
    REQUEST_ID,
    NOTIFICATION,
  )
  expect(request && signBidirectionalEventJson(request)).toEqual({
    keyVersion: 1,
    sender: CALLER,
    path: 'bad98eb937feab871303240f667a90141071b40780c58612430ed158b5cf1100',
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
          '00000000000000000000000033935df7dc34f4b26cfe9a92d918f9e3e30095df',
          '00000000000000000000000000000000000000000000000000000000000dbba0',
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
    inspectSignBidirectionalTransaction(SIGN_BIDIRECTIONAL_RAW_TRANSACTION_HEX, REQUEST_ID, {
      ...NOTIFICATION,
      requestsPath: [2, 4],
    }).request,
  ).toBeNull()
  expect(
    inspectSignBidirectionalTransaction(
      SIGN_BIDIRECTIONAL_RAW_TRANSACTION_HEX,
      parseRequestIdHex('00'.repeat(32)),
      NOTIFICATION,
    ).request,
  ).toBeNull()
})
