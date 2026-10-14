import { bytesToHex, EvmTraceOutputKind, OutputKind } from '@sig-net/midnight'
import { expect, test } from 'vitest'

import { type AttestedExecution, checkAttestation, checkAttestedOutput } from './attestation-check'
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

function cached(serializedOutput: Uint8Array): AttestedExecution {
  return { status: 'cached', serializedOutput }
}

test('an attestation by the response key is valid for every output kind, with no output consulted', () => {
  for (const attestation of [EXECUTED_ATTESTATION, ...Object.values(EMPTY_OUTPUT_ATTESTATIONS)]) {
    expect(checkAttestation(ROOT_KEY, CALLER, attestation)).toEqual({
      status: 'valid',
      responseKey: RESPONSE_KEY,
      outputKind: attestation.outputKind,
      blockHeight: BLOCK_HEIGHT,
      output: null,
    })
  }
})

test('an attestation by another key, or altered after signing, is invalid', () => {
  expect(checkAttestation(ROOT_KEY, CALLER, FOREIGN_KEY_ATTESTATION)).toMatchObject({
    status: 'invalid',
    responseKey: RESPONSE_KEY,
  })
  const failed = EMPTY_OUTPUT_ATTESTATIONS[OutputKind.failed]
  for (const altered of [
    { ...failed, outputKind: OutputKind.executed },
    { ...failed, blockHeight: BLOCK_HEIGHT + 1n },
    { ...failed, serializedOutputLength: 1n },
    { ...failed, outputHash: EXECUTED_ATTESTATION.outputHash },
  ]) {
    expect(checkAttestation(ROOT_KEY, CALLER, altered)).toMatchObject({ status: 'invalid' })
  }
})

test('an invalid root key checks nothing', () => {
  expect(checkAttestation('', CALLER, EXECUTED_ATTESTATION)).toEqual({ status: 'no-root-key' })
})

test('the traced return data is the attested output, decoded beside the bytes', () => {
  expect(checkAttestedOutput(EXECUTED_ATTESTATION, traced(TRUE_WORD))).toEqual({
    status: 'attested',
    source: 'evm-node',
    decodedOutput: { success: true },
    serializedOutput: new Uint8Array([1]),
  })
})

test('the cached bytes are the attested output, which carries no decoded output', () => {
  expect(checkAttestedOutput(EXECUTED_ATTESTATION, cached(new Uint8Array([1])))).toEqual({
    status: 'attested',
    source: 'mpc-cache',
    decodedOutput: null,
    serializedOutput: new Uint8Array([1]),
  })
})

test('cached bytes of another hash or width are a mismatch', () => {
  expect(checkAttestedOutput(EXECUTED_ATTESTATION, cached(new Uint8Array([0])))).toEqual({
    status: 'mismatch',
    source: 'mpc-cache',
    reason: 'the MPC cache holds bytes of another hash for this request',
  })
  expect(checkAttestedOutput(EXECUTED_ATTESTATION, cached(new Uint8Array([1, 1])))).toEqual({
    status: 'mismatch',
    source: 'mpc-cache',
    reason: 'the MPC cache holds 2 bytes, and the attestation declares 1 for this request',
  })
})

test('a trace that yields another output, no output or no respond output is a mismatch', () => {
  expect(checkAttestedOutput(EXECUTED_ATTESTATION, traced(FALSE_WORD))).toEqual({
    status: 'mismatch',
    source: 'evm-node',
    reason: 'the trace yields an output of another hash',
  })
  expect(checkAttestedOutput(EXECUTED_ATTESTATION, traced('0x1234'))).toMatchObject({
    status: 'mismatch',
    reason: expect.stringContaining('not whole ABI words'),
  })
  expect(
    checkAttestedOutput(EXECUTED_ATTESTATION, {
      status: 'traced',
      request: REQUEST,
      transactionOutput: { status: 'unreadable', reason: 'the call reverted' },
    }),
  ).toMatchObject({ status: 'mismatch', reason: expect.stringContaining('the call reverted') })
})

test('with no output obtained the check is unavailable, with the reason', () => {
  expect(
    checkAttestedOutput(EXECUTED_ATTESTATION, { status: 'unavailable', reason: 'gated' }),
  ).toEqual({ status: 'unavailable', reason: 'gated' })
})
