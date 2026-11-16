import { PREPROD_REQUEST_CELL_WIRE, PREPROD_REQUEST_ID } from '@sig-net/explorer-api/testing'
import type { SignBidirectionalLifecycle } from '@sig-net/explorer-lib'
import { parseRequestIdHex, SignetEventName } from '@sig-net/midnight'
import { describe, expect, it } from 'vitest'

import { inspectTransactionForStorage } from './sign-bidirectional-transaction-inspection.ts'
import { SIGN_BIDIRECTIONAL_RAW_TRANSACTION_HEX } from './sign-bidirectional-transaction-inspection.fixture.ts'

// The preprod signer the fixture transaction calls, and the contract that calls it.
const SIGNER = '798e602d58ca65bae159464f43091bd790b3ef23f10abb49d962bc0efeb00c5e'
const CALLER = '4890aeb5fb2eaee7dafe6c87ca73d34807ce61b92d4542c1c82e2296e5e2a728'
const TRANSACTION_HASH = 'f435136b61a0a0d07b34aa64ffde3a947977dbcf8dbb502c3a7dcfcba8b5194f'

type Notification = SignBidirectionalLifecycle['signBidirectionalEvents'][number]

function notification(
  id: number,
  requestId: string,
  requestsPath: readonly number[],
): Notification {
  return {
    name: SignetEventName.SignBidirectionalEvent,
    requestId: parseRequestIdHex(requestId),
    record: { version: 1, callerAddress: CALLER, requestsPath: [...requestsPath] },
    source: {
      id,
      name: SignetEventName.SignBidirectionalEvent,
      payload: new Uint8Array(256),
      transactionHash: TRANSACTION_HASH,
      blockHeight: 3373157,
      blockHash: '00'.repeat(32),
      blockTimestamp: new Date('2026-09-07T12:00:00Z'),
    },
    roles: ['signer'],
  }
}

describe('inspectTransactionForStorage', () => {
  it('stores the call chains and the request cell of the fixture transaction', () => {
    expect(
      inspectTransactionForStorage(SIGN_BIDIRECTIONAL_RAW_TRANSACTION_HEX, [
        notification(7, PREPROD_REQUEST_ID, [2, 5]),
      ]),
    ).toEqual({
      callChains: [
        {
          entryPoint: 'sendDeposit',
          address: CALLER,
          fallible: true,
          calls: [{ entryPoint: 'signBidirectional', address: SIGNER, fallible: true, calls: [] }],
        },
      ],
      requests: { '7': { cell: PREPROD_REQUEST_CELL_WIRE } },
    })
  })

  it('stores a null cell for a notification the transaction does not write', () => {
    const inspection = inspectTransactionForStorage(SIGN_BIDIRECTIONAL_RAW_TRANSACTION_HEX, [
      notification(7, PREPROD_REQUEST_ID, [2, 4]),
      notification(8, '00'.repeat(32), [2, 5]),
    ])
    expect(inspection).toMatchObject({
      requests: { '7': { cell: null }, '8': { cell: null } },
    })
  })

  it('stores one failed notification beside a read one', () => {
    // The caller also inserts a one-atom cell under the request id at [2, 0], which is no request record.
    const inspection = inspectTransactionForStorage(SIGN_BIDIRECTIONAL_RAW_TRANSACTION_HEX, [
      notification(7, PREPROD_REQUEST_ID, [2, 5]),
      notification(9, PREPROD_REQUEST_ID, [2, 0]),
    ])
    if ('failed' in inspection) {
      throw new Error(`the whole inspection failed: ${inspection.failed}`)
    }
    expect(inspection.callChains).toHaveLength(1)
    expect(inspection.requests['7']).toEqual({ cell: PREPROD_REQUEST_CELL_WIRE })
    expect(inspection.requests['9']).toEqual({ failed: expect.any(String) })
  })

  it('stores a transaction that does not deserialise as failed', () => {
    expect(
      inspectTransactionForStorage('deadbeef', [notification(7, PREPROD_REQUEST_ID, [2, 5])]),
    ).toEqual({ failed: expect.any(String) })
  })
})
