import {
  bytesToHex,
  EvmTraceOutputKind,
  OutputKind,
  type RespondBidirectionalEvent,
} from '@sig-net/midnight'
import { expect, test } from 'vitest'

import {
  type AttestationCheck,
  type AttestedExecution,
  checkAttestationOverEmptyOutput,
  checkAttestationOverExecution,
} from './attestation-check'
import {
  EMPTY_OUTPUT_ATTESTATIONS,
  EXECUTED_TRUE_ATTESTATION as EXECUTED_ATTESTATION,
  FIXTURE_BLOCK_HEIGHT as BLOCK_HEIGHT,
  FIXTURE_MPC_ROOT_KEY as ROOT_KEY,
  FIXTURE_RESPONSE_KEY as RESPONSE_KEY,
  FOREIGN_KEY_ATTESTATION,
} from './respond-bidirectional-event.fixture'
import { STAGENET_REQUEST as REQUEST } from './sign-bidirectional-event.fixture'

const CALLER = bytesToHex(REQUEST.sender.bytes)

const TRUE_WORD = `0x${'0'.repeat(63)}1`
const FALSE_WORD = `0x${'0'.repeat(64)}`

function traced(returnData: string): AttestedExecution {
  return {
    status: 'traced',
    request: REQUEST,
    transactionOutput: { status: 'read', trace: { kind: EvmTraceOutputKind.Output, returnData } },
  }
}

function overExecution(
  attestation: RespondBidirectionalEvent,
  execution: AttestedExecution,
): AttestationCheck {
  return checkAttestationOverExecution(ROOT_KEY, CALLER, attestation, execution)
}

function overEmptyOutput(attestation: RespondBidirectionalEvent): AttestationCheck {
  return checkAttestationOverEmptyOutput(ROOT_KEY, CALLER, attestation)
}

test('an executed attestation is valid over the traced return data', () => {
  expect(overExecution(EXECUTED_ATTESTATION, traced(TRUE_WORD))).toEqual({
    status: 'valid',
    responseKey: RESPONSE_KEY,
    outputKind: OutputKind.executed,
    blockHeight: BLOCK_HEIGHT,
    output: {
      source: 'evm-node',
      decodedOutput: { success: true },
      serializedOutput: new Uint8Array([1]),
    },
  })
})

test('an executed attestation is valid over the cached bytes, which carry no decoded output', () => {
  expect(
    overExecution(EXECUTED_ATTESTATION, {
      status: 'cached',
      serializedOutput: new Uint8Array([1]),
    }),
  ).toEqual({
    status: 'valid',
    responseKey: RESPONSE_KEY,
    outputKind: OutputKind.executed,
    blockHeight: BLOCK_HEIGHT,
    output: { source: 'mpc-cache', decodedOutput: null, serializedOutput: new Uint8Array([1]) },
  })
})

test('cached bytes the attestation is not over are invalid, by content or by width', () => {
  expect(
    overExecution(EXECUTED_ATTESTATION, {
      status: 'cached',
      serializedOutput: new Uint8Array([0]),
    }),
  ).toMatchObject({ status: 'invalid', reason: expect.stringContaining('MPC cache holds for') })
  expect(
    overExecution(EXECUTED_ATTESTATION, {
      status: 'cached',
      serializedOutput: new Uint8Array([1, 1]),
    }),
  ).toMatchObject({ status: 'invalid', reason: expect.stringContaining('holds 2 bytes') })
})

test('an attestation that is not over the traced return data is invalid', () => {
  expect(overExecution(EXECUTED_ATTESTATION, traced(FALSE_WORD))).toEqual({
    status: 'invalid',
    responseKey: RESPONSE_KEY,
    reason: 'the attestation is not over the traced output',
  })
  expect(overExecution(EXECUTED_ATTESTATION, traced('0x1234'))).toMatchObject({
    status: 'invalid',
    reason: expect.stringContaining('not whole ABI words'),
  })
  expect(
    overExecution(EXECUTED_ATTESTATION, {
      status: 'traced',
      request: REQUEST,
      transactionOutput: { status: 'unreadable', reason: 'the call reverted' },
    }),
  ).toMatchObject({ status: 'invalid', reason: expect.stringContaining('the call reverted') })
})

test('with no output obtained an attestation is unverified, and still names the response key', () => {
  expect(overExecution(EXECUTED_ATTESTATION, { status: 'unavailable', reason: 'gated' })).toEqual({
    status: 'unverified',
    responseKey: RESPONSE_KEY,
    reason: 'gated',
  })
})

test.for([OutputKind.executed, OutputKind.failed, OutputKind.unviable])(
  'an attestation of output kind %s over an empty output is valid, with no output obtained',
  (outputKind) => {
    expect(overEmptyOutput(EMPTY_OUTPUT_ATTESTATIONS[outputKind])).toEqual({
      status: 'valid',
      responseKey: RESPONSE_KEY,
      outputKind,
      blockHeight: BLOCK_HEIGHT,
      output: null,
    })
  },
)

test('an attestation that declares bytes is invalid over an empty output', () => {
  expect(overEmptyOutput(EXECUTED_ATTESTATION)).toMatchObject({
    status: 'invalid',
    responseKey: RESPONSE_KEY,
  })
})

test('an attestation by another key, or altered after signing, is invalid', () => {
  expect(overEmptyOutput(FOREIGN_KEY_ATTESTATION)).toMatchObject({
    status: 'invalid',
    responseKey: RESPONSE_KEY,
  })
  const failed = EMPTY_OUTPUT_ATTESTATIONS[OutputKind.failed]
  expect(overEmptyOutput({ ...failed, outputKind: OutputKind.executed })).toMatchObject({
    status: 'invalid',
  })
  expect(overEmptyOutput({ ...failed, blockHeight: BLOCK_HEIGHT + 1n })).toMatchObject({
    status: 'invalid',
  })
})

test('an invalid root key checks nothing', () => {
  expect(
    checkAttestationOverExecution('', CALLER, EXECUTED_ATTESTATION, traced(TRUE_WORD)),
  ).toEqual({ status: 'no-root-key' })
  expect(
    checkAttestationOverEmptyOutput('', CALLER, EMPTY_OUTPUT_ATTESTATIONS[OutputKind.failed]),
  ).toEqual({ status: 'no-root-key' })
})
