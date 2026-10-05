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
  type Secp256k1Point,
  type SignBidirectionalEvent,
  verifyRespondBidirectionalSignature,
} from '@sig-net/midnight'

import type { EvmTransactionOutput } from '@/lib/midnight/evm-transaction-output'
import { parseMpcRootPublicKey } from '@/lib/midnight/network'

/** Where an attested output was obtained. */
export type AttestedOutputSource = 'mpc-cache' | 'evm-node'

/** What is known of the foreign execution an attestation is checked against. */
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

/** An output obtained for an attestation, which the attestation verified over. */
export interface AttestedOutput {
  readonly source: AttestedOutputSource
  readonly serializedOutput: Uint8Array
  /**
   * The transaction's return data, decoded by the request's output deserialisation schema. Null
   * unless the output was rebuilt from a trace that carries return data.
   */
  readonly decodedOutput: AbiDecodedOutput | null
}

/** Whether a posted attestation is by the requesting contract's response key, and over what. */
export type AttestationCheck =
  /** The configured MPC root public key is not a valid key, so the contract has no key to check. */
  | { readonly status: 'no-root-key' }
  | {
      readonly status: 'valid'
      readonly responseKey: string
      /** The MPC's verdict on the execution, which the signature covers. */
      readonly outputKind: OutputKind
      /** Height of the finalised destination block that settled the verdict, signed as well. */
      readonly blockHeight: bigint
      /** Null when the attestation verified over an empty output, with none obtained. */
      readonly output: AttestedOutput | null
    }
  /** The signature is not by the response key over the output it was checked against. */
  | { readonly status: 'invalid'; readonly responseKey: string; readonly reason: string }
  /** No output could be obtained to check the attestation against. */
  | { readonly status: 'unverified'; readonly responseKey: string; readonly reason: string }

interface ResponseKey {
  readonly point: Secp256k1Point
  readonly hex: string
}

/** The response key of `callerAddress`, or null when the MPC root public key is not a valid key. */
function deriveResponseKey(mpcRootPublicKey: string, callerAddress: string): ResponseKey | null {
  const rootKey = parseMpcRootPublicKey(mpcRootPublicKey)
  if (rootKey === null) {
    return null
  }
  const point = deriveMidnightResponseKey(rootKey, callerAddress)
  return { point, hex: formatSecp256k1PublicKey(point) }
}

/** Valid when the signature is by `responseKey` over `output`, an empty output while null. */
function judge(
  attestation: RespondBidirectionalEvent,
  responseKey: ResponseKey,
  output: AttestedOutput | null,
  mismatch: string,
): AttestationCheck {
  const serializedOutput = output?.serializedOutput ?? new Uint8Array(0)
  return verifyRespondBidirectionalSignature(serializedOutput, attestation, responseKey.point)
    ? {
        status: 'valid',
        responseKey: responseKey.hex,
        outputKind: attestation.outputKind,
        blockHeight: attestation.blockHeight,
        output,
      }
    : { status: 'invalid', responseKey: responseKey.hex, reason: mismatch }
}

/**
 * Judges a posted attestation against the response key of `callerAddress` over an empty output,
 * which is what an attestation declaring a width of zero covers.
 */
export function checkAttestationOverEmptyOutput(
  mpcRootPublicKey: string,
  callerAddress: string,
  attestation: RespondBidirectionalEvent,
): AttestationCheck {
  const responseKey = deriveResponseKey(mpcRootPublicKey, callerAddress)
  if (responseKey === null) {
    return { status: 'no-root-key' }
  }
  return judge(
    attestation,
    responseKey,
    null,
    'the signature is not over the request, block height and output kind the attestation declares, with an empty output',
  )
}

/**
 * Judges a posted attestation against the response key of `callerAddress` over the output that
 * `execution` yields.
 */
export function checkAttestationOverExecution(
  mpcRootPublicKey: string,
  callerAddress: string,
  attestation: RespondBidirectionalEvent,
  execution: AttestedExecution,
): AttestationCheck {
  const responseKey = deriveResponseKey(mpcRootPublicKey, callerAddress)
  if (responseKey === null) {
    return { status: 'no-root-key' }
  }
  const invalid = (reason: string): AttestationCheck => ({
    status: 'invalid',
    responseKey: responseKey.hex,
    reason,
  })
  if (execution.status === 'unavailable') {
    return { status: 'unverified', responseKey: responseKey.hex, reason: execution.reason }
  }
  if (execution.status === 'cached') {
    const { serializedOutput } = execution
    if (BigInt(serializedOutput.length) !== attestation.serializedOutputLength) {
      return invalid(
        `the MPC cache holds ${String(serializedOutput.length)} bytes for this request, and the attestation declares ${attestation.serializedOutputLength.toString()}`,
      )
    }
    return judge(
      attestation,
      responseKey,
      { source: 'mpc-cache', serializedOutput, decodedOutput: null },
      'the attestation is not over the output the MPC cache holds for this request',
    )
  }
  const { request, transactionOutput } = execution
  if (transactionOutput.status === 'unreadable') {
    return invalid(`the traced transaction yields no output: ${transactionOutput.reason}`)
  }
  const { trace } = transactionOutput
  const schema = request.outputDeserializationSchema
  let output: AttestedOutput
  try {
    output = {
      source: 'evm-node',
      serializedOutput: executedEvmRespondOutput(
        schema,
        isEvmContractCall(assembleCalldata(request.txParams.calldata)),
        trace,
      ),
      decodedOutput:
        trace.kind === EvmTraceOutputKind.Output
          ? deserializeEvmOutput(schema, trace.returnData)
          : null,
    }
  } catch (error) {
    return invalid(
      `the traced return data yields no respond output: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  return judge(attestation, responseKey, output, 'the attestation is not over the traced output')
}
