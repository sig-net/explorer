import {
  type AbiDecodedOutput,
  deriveMidnightResponseKey,
  deserializeEvmOutput,
  formatSecp256k1PublicKey,
  MPC_FAILURE_OUTPUT,
  type RequestIdHex,
  requestIdBytes,
  type RespondBidirectionalEvent,
  serializeRespondOutput,
  type SignBidirectionalEvent,
  verifyRespondBidirectionalSignature,
} from '@sig-net/midnight'

import type { EvmTransactionOutput } from '@/lib/midnight/evm-transaction-output'
import { parseMpcRootPublicKey } from '@/lib/midnight/network'

/** What is known of the foreign execution an attestation is checked against. */
export type AttestedExecution =
  | {
      readonly status: 'traced'
      readonly request: SignBidirectionalEvent
      readonly trace: EvmTransactionOutput
    }
  /** No return data to check against, and why. */
  | { readonly status: 'unavailable'; readonly reason: string }

/** Whether a posted attestation is by the requesting contract's response key, and over what. */
export type AttestationCheck =
  /** The configured MPC root public key is not a valid key, so the contract has no key to check. */
  | { readonly status: 'no-root-key' }
  /** The attestation is over the fixed failure payload: the MPC saw the foreign transaction fail. */
  | {
      readonly status: 'valid-failure'
      readonly responseKey: string
      readonly serializedOutput: Uint8Array
    }
  | {
      readonly status: 'valid-success'
      readonly responseKey: string
      /** The transaction's return data, decoded by the request's output deserialisation schema. */
      readonly decodedOutput: AbiDecodedOutput
      /** The attested bytes: `decodedOutput` packed by the request's respond serialisation schema. */
      readonly serializedOutput: Uint8Array
    }
  /** The transaction's return data was recovered, and the attestation is not over it. */
  | { readonly status: 'invalid'; readonly responseKey: string; readonly reason: string }
  /** Not over the failure payload, and no return data to check a success against. */
  | { readonly status: 'unverified'; readonly responseKey: string; readonly reason: string }

export function checkAttestation(
  mpcRootPublicKey: string,
  requestId: RequestIdHex,
  callerAddress: string,
  attestation: RespondBidirectionalEvent,
  execution: AttestedExecution,
): AttestationCheck {
  const rootKey = parseMpcRootPublicKey(mpcRootPublicKey)
  if (rootKey === null) {
    return { status: 'no-root-key' }
  }
  const responseKeyPoint = deriveMidnightResponseKey(rootKey, callerAddress)
  const responseKey = formatSecp256k1PublicKey(responseKeyPoint)
  const attests = (serializedOutput: Uint8Array): boolean =>
    verifyRespondBidirectionalSignature(
      requestIdBytes(requestId),
      serializedOutput,
      attestation,
      responseKeyPoint,
    )
  if (attests(MPC_FAILURE_OUTPUT)) {
    return { status: 'valid-failure', responseKey, serializedOutput: MPC_FAILURE_OUTPUT }
  }
  if (execution.status === 'unavailable') {
    return { status: 'unverified', responseKey, reason: execution.reason }
  }
  const { request, trace } = execution
  if (trace.reverted) {
    return {
      status: 'invalid',
      responseKey,
      reason: 'the transaction reverted, and the attestation is not over the failure payload',
    }
  }
  let decodedOutput: AbiDecodedOutput
  let serializedOutput: Uint8Array
  try {
    decodedOutput = deserializeEvmOutput(request.outputDeserializationSchema, trace.output)
    serializedOutput = serializeRespondOutput(request.respondSerializationSchema, decodedOutput)
  } catch (error) {
    return {
      status: 'invalid',
      responseKey,
      reason: `the return data does not fit the request's schemas: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
  return attests(serializedOutput)
    ? { status: 'valid-success', responseKey, decodedOutput, serializedOutput }
    : { status: 'invalid', responseKey, reason: 'the attestation is not over the recovered output' }
}
