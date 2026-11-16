import {
  type AbiDecodedOutput,
  assembleCalldata,
  deriveMidnightResponseKey,
  deserializeEvmOutput,
  EvmTraceOutputKind,
  executedEvmRespondOutput,
  formatSecp256k1PublicKey,
  isEvmContractCall,
  type OutputKind,
  type RespondBidirectionalEvent,
  type SignBidirectionalEvent,
  verifyAttestedOutput,
  verifyRespondBidirectionalAttestation,
} from '@sig-net/midnight'

import type { EvmTransactionOutput } from '@/lib/midnight/evm-transaction-output'
import { parseMpcRootPublicKey } from '@/lib/midnight/network'

/** Whether a posted attestation is by the requesting contract's response key, and over what. */
export type AttestationCheck =
  /** The configured MPC root public key is not a valid key, so the contract has no key to check. */
  | { readonly status: 'no-root-key' }
  | {
      readonly status: 'valid'
      readonly responseKey: string
      /** The MPC's verdict on the execution, which the signature covers. */
      readonly outputKind: OutputKind
      /** Height of the finalised target-chain block that settled the verdict, signed as well. */
      readonly blockHeight: bigint
      /** Null when no output was consulted. */
      readonly output: AttestedOutputCheck | null
    }
  /** The signature is not by the response key over the fields the attestation declares. */
  | { readonly status: 'invalid'; readonly responseKey: string; readonly reason: string }

/** Where an attested output was obtained. */
export type AttestedOutputSource = 'mpc-cache' | 'evm-node'

/** Whether an output obtained for an attestation is the one it declares, by width and hash. */
export type AttestedOutputCheck =
  | {
      readonly status: 'attested'
      readonly source: AttestedOutputSource
      readonly serializedOutput: Uint8Array
      /**
       * The transaction's return data, decoded by the request's output deserialisation schema.
       * Null unless the output was rebuilt from a trace that carries return data.
       */
      readonly decodedOutput: AbiDecodedOutput | null
    }
  /** The source yielded an output, and it is not the attested one. */
  | { readonly status: 'mismatch'; readonly source: AttestedOutputSource; readonly reason: string }
  /** No output could be obtained, and why. */
  | { readonly status: 'unavailable'; readonly reason: string }

/** What is known of the foreign execution an attestation's output is checked against. */
export type AttestedExecution =
  /** The serialised output the MPC cached before posting, verbatim and unverified. */
  | { readonly status: 'cached'; readonly serializedOutput: Uint8Array }
  | {
      readonly status: 'traced'
      readonly request: SignBidirectionalEvent
      readonly transactionOutput: EvmTransactionOutput
    }
  /** No output to check against, and why. */
  | { readonly status: 'unavailable'; readonly reason: string }

/**
 * Judges a posted attestation's signature against the response key of `callerAddress`, over the
 * request id, block height, output kind, output width and output hash it declares. The output
 * itself is judged by {@link checkAttestedOutput}.
 */
export function checkAttestation(
  mpcRootPublicKey: string,
  callerAddress: string,
  attestation: RespondBidirectionalEvent,
): AttestationCheck {
  const rootKey = parseMpcRootPublicKey(mpcRootPublicKey)
  if (rootKey === null) {
    return { status: 'no-root-key' }
  }
  const responseKeyPoint = deriveMidnightResponseKey(rootKey, callerAddress)
  const responseKey = formatSecp256k1PublicKey(responseKeyPoint)
  return verifyRespondBidirectionalAttestation(attestation, responseKeyPoint)
    ? {
        status: 'valid',
        responseKey,
        outputKind: attestation.outputKind,
        blockHeight: attestation.blockHeight,
        output: null,
      }
    : {
        status: 'invalid',
        responseKey,
        reason:
          'the signature is not over the request, block height, output kind, output width and output hash the attestation declares',
      }
}

/** Judges the output `execution` yields against the width and hash `attestation` declares. */
export function checkAttestedOutput(
  attestation: RespondBidirectionalEvent,
  execution: AttestedExecution,
): AttestedOutputCheck {
  const { serializedOutputLength, outputHash } = attestation
  const attested = (serializedOutput: Uint8Array): boolean =>
    verifyAttestedOutput(serializedOutput, serializedOutputLength, outputHash)
  const widthMismatch = (serializedOutput: Uint8Array): string | null =>
    BigInt(serializedOutput.length) === serializedOutputLength
      ? null
      : `${String(serializedOutput.length)} bytes, and the attestation declares ${serializedOutputLength.toString()}`
  if (execution.status === 'unavailable') {
    return { status: 'unavailable', reason: execution.reason }
  }
  if (execution.status === 'cached') {
    const { serializedOutput } = execution
    if (attested(serializedOutput)) {
      return { status: 'attested', source: 'mpc-cache', serializedOutput, decodedOutput: null }
    }
    return {
      status: 'mismatch',
      source: 'mpc-cache',
      reason: `the MPC cache holds ${widthMismatch(serializedOutput) ?? 'bytes of another hash'} for this request`,
    }
  }
  const { request, transactionOutput } = execution
  if (transactionOutput.status === 'unreadable') {
    return {
      status: 'mismatch',
      source: 'evm-node',
      reason: `the traced transaction yields no output: ${transactionOutput.reason}`,
    }
  }
  const { trace } = transactionOutput
  const schema = request.outputDeserializationSchema
  let serializedOutput: Uint8Array
  let decodedOutput: AbiDecodedOutput | null
  try {
    serializedOutput = executedEvmRespondOutput(
      schema,
      isEvmContractCall(assembleCalldata(request.txParams.calldata)),
      trace,
    )
    decodedOutput =
      trace.kind === EvmTraceOutputKind.Output
        ? deserializeEvmOutput(schema, trace.returnData)
        : null
  } catch (error) {
    return {
      status: 'mismatch',
      source: 'evm-node',
      reason: `the traced return data yields no respond output: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
  if (attested(serializedOutput)) {
    return { status: 'attested', source: 'evm-node', serializedOutput, decodedOutput }
  }
  return {
    status: 'mismatch',
    source: 'evm-node',
    reason: `the trace yields ${widthMismatch(serializedOutput) ?? 'an output of another hash'}`,
  }
}
