import {
  bytesToHex,
  getMpcRootPublicKey,
  hexToBytes,
  MidnightNetwork,
  MPC_FAILURE_OUTPUT,
  parseRequestIdHex,
  type RespondBidirectionalEvent,
} from '@sig-net/midnight'
import { expect, test } from 'vitest'

import { type AttestedExecution, checkAttestation } from './attestation-check'
import { STAGENET_REQUEST as REQUEST } from './sign-bidirectional-event.fixture'

const ROOT_KEY = getMpcRootPublicKey(MidnightNetwork.Stagenet)
const REQUEST_ID = parseRequestIdHex(
  'ee795d04cfc07be83245957f738e9866e90f20055a8bf70cf4dcd7221295ae00',
)
const CALLER = bytesToHex(REQUEST.sender.bytes)
const RESPONSE_KEY =
  '0x04b7502b676ad8613d6e5c73caddbc6384f1b8b019b63ada2d52a66b30d6a3ac595f5e59a7792eacd0eb1954a9d527cdd3cf85522328086ec37fe3153add1b990f'

// The attestation the stagenet MPC posted for the request: over the ERC20 transfer's `true`.
const MPC_ATTESTATION: RespondBidirectionalEvent = {
  signature: {
    bigR: {
      x: hexToBytes('8c30125f3710cb1e13385e20a4fc2a65be75dca4deb196771a5da09f1cc8c10b'),
      y: hexToBytes('fd48d8bdb3b7d5ac78e24efe8e1be2dd5bb1958ccf307eeb83c74d58812438ff'),
    },
    s: hexToBytes('59d25d2ca2aaceeb0ea52ee1edd1880d58b1cabb358cec09c3272de9f310f439'),
    recoveryId: 0n,
  },
}

const TRUE_WORD = `0x${'0'.repeat(63)}1`
const FALSE_WORD = `0x${'0'.repeat(64)}`

function traced(output: string, reverted = false): AttestedExecution {
  return { status: 'traced', request: REQUEST, trace: { output, reverted } }
}

test('the MPC attestation is valid over the traced return data', () => {
  expect(
    checkAttestation(ROOT_KEY, REQUEST_ID, CALLER, MPC_ATTESTATION, traced(TRUE_WORD)),
  ).toEqual({
    status: 'valid-success',
    responseKey: RESPONSE_KEY,
    decodedOutput: { success: true },
    serializedOutput: new Uint8Array([1]),
  })
})

test('an attestation that is not over the traced return data is invalid', () => {
  expect(
    checkAttestation(ROOT_KEY, REQUEST_ID, CALLER, MPC_ATTESTATION, traced(FALSE_WORD)),
  ).toMatchObject({ status: 'invalid', responseKey: RESPONSE_KEY })
  expect(
    checkAttestation(ROOT_KEY, REQUEST_ID, CALLER, MPC_ATTESTATION, traced('0x', true)),
  ).toMatchObject({ status: 'invalid' })
  expect(
    checkAttestation(ROOT_KEY, REQUEST_ID, CALLER, MPC_ATTESTATION, traced('0x1234')),
  ).toMatchObject({ status: 'invalid' })
})

test('without return data a success attestation is unverified, and still names the response key', () => {
  expect(
    checkAttestation(ROOT_KEY, REQUEST_ID, CALLER, MPC_ATTESTATION, {
      status: 'unavailable',
      reason: 'gated',
    }),
  ).toEqual({ status: 'unverified', responseKey: RESPONSE_KEY, reason: 'gated' })
})

// An attestation over the failure payload for the same request and caller, minted in Node with the
// SDK's testing helpers under the root secret key 0x11 repeated 32 times.
const FAILURE_ROOT_KEY =
  '0x044f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa385b6b1b8ead809ca67454d9683fcf2ba03456d6fe2c4abe2b07f0fbdbb2f1c1'
const FAILURE_ATTESTATION: RespondBidirectionalEvent = {
  signature: {
    bigR: {
      x: hexToBytes('ff07e3bc85f9b8e76801892ee3af90972e3d84cc796902c442693db15007e26b'),
      y: hexToBytes('26e2c45f893ec7da0dc5d4ebf0707ac239de4fb163fdefb5e3eeaa53a02efed6'),
    },
    s: hexToBytes('044ec9ca66b5ea4938bf2eae78539b2be10a82ebd898f632c45d6c7ee5d20c8c'),
    recoveryId: 0n,
  },
}

test('an attestation over the failure payload is valid with no return data', () => {
  expect(
    checkAttestation(FAILURE_ROOT_KEY, REQUEST_ID, CALLER, FAILURE_ATTESTATION, {
      status: 'unavailable',
      reason: 'gated',
    }),
  ).toMatchObject({ status: 'valid-failure', serializedOutput: MPC_FAILURE_OUTPUT })
})

test('an invalid root key checks nothing', () => {
  expect(checkAttestation('', REQUEST_ID, CALLER, MPC_ATTESTATION, traced(TRUE_WORD))).toEqual({
    status: 'no-root-key',
  })
})
