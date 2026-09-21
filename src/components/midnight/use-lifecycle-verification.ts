import type { SignBidirectionalEvent } from '@sig-net/midnight'
import { useEffect, useState } from 'react'

import { useMidnight } from '@/components/contexts/MidnightContext'
import {
  type AttestationCheck,
  type AttestedExecution,
  checkAttestation,
} from '@/lib/midnight/attestation-check'
import { loadEvmTransactionOutput } from '@/lib/midnight/evm-transaction-output'
import { evmRpcUrl } from '@/lib/midnight/evm-transaction-status'
import type { MidnightNetworkConfig } from '@/lib/midnight/network'
import type { SignBidirectionalLifecycle } from '@/lib/midnight/sign-bidirectional-lifecycle'
import { loadSignBidirectionalTransactionInspection } from '@/lib/midnight/sign-bidirectional-transaction-loader'
import { checkSignature } from '@/lib/midnight/signature-check'

export type AttestationChecksState =
  | { readonly status: 'loading' }
  /** Without a notification the lifecycle names no requesting contract, so no response key. */
  | { readonly status: 'no-notification' }
  /** Keyed by the respond bidirectional event's source id. */
  | { readonly status: 'checked'; readonly checks: ReadonlyMap<number, AttestationCheck> }

export interface LifecycleVerification {
  /** Source ids of the signature responses that are by a notification's request signing key. */
  readonly validSignatureResponseIds: ReadonlySet<number>
  readonly attestationChecks: AttestationChecksState
}

/** A verification, tagged with the configuration it was made under. */
interface SettledVerification {
  readonly configKey: string
  readonly verification: LifecycleVerification
}

const UNSETTLED: LifecycleVerification = {
  validSignatureResponseIds: new Set(),
  attestationChecks: { status: 'loading' },
}

async function traceFirst(
  rpcUrl: string,
  hashes: readonly string[],
): Promise<Awaited<ReturnType<typeof loadEvmTransactionOutput>>> {
  let failure: unknown = new Error('no valid signature, so no signed transaction to trace')
  // Each valid signature signs the same transaction into a different hash, and one at most is mined.
  for (const hash of hashes) {
    try {
      return await loadEvmTransactionOutput(rpcUrl, hash)
    } catch (error) {
      failure = error
    }
  }
  throw failure
}

async function recoverExecution(
  rpcUrls: Pick<MidnightNetworkConfig, 'ethereumMainnetRpcUrl' | 'ethereumSepoliaRpcUrl'>,
  request: SignBidirectionalEvent | undefined,
  signedTransactionHashes: readonly string[],
): Promise<AttestedExecution> {
  if (request === undefined) {
    return { status: 'unavailable', reason: 'no request record could be read' }
  }
  const rpcUrl = evmRpcUrl(rpcUrls, request.txParams.chainId)
  if (rpcUrl === null) {
    return {
      status: 'unavailable',
      reason: `no RPC endpoint is configured for chain ${request.txParams.chainId.toString()}`,
    }
  }
  try {
    return { status: 'traced', request, trace: await traceFirst(rpcUrl, signedTransactionHashes) }
  } catch (error) {
    return { status: 'unavailable', reason: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Checks an expanded lifecycle's responses against its requests: which signature responses are by a
 * request signing key, and whether each attestation is by the requesting contract's response key.
 * The signature result settles first, as the attestation check waits on a trace of the signed
 * transaction.
 */
export function useLifecycleVerification(
  lifecycle: SignBidirectionalLifecycle,
): LifecycleVerification {
  const { indexerUrl, mpcRootPublicKey, ethereumMainnetRpcUrl, ethereumSepoliaRpcUrl } =
    useMidnight().config
  const configKey = JSON.stringify([
    indexerUrl,
    mpcRootPublicKey,
    ethereumMainnetRpcUrl,
    ethereumSepoliaRpcUrl,
  ])
  const [settled, setSettled] = useState<SettledVerification | null>(null)

  useEffect(() => {
    let current = true
    const settle = (verification: LifecycleVerification) => {
      if (current) {
        setSettled({ configKey, verification })
      }
    }
    const { requestId, signBidirectionalEvents, signatureRespondedEvents } = lifecycle
    const verify = async () => {
      const inspections = await Promise.allSettled(
        signBidirectionalEvents.map((notification) =>
          loadSignBidirectionalTransactionInspection(indexerUrl, notification),
        ),
      )
      const requests = inspections.flatMap((inspection) =>
        inspection.status === 'fulfilled' && inspection.value.request !== null
          ? [inspection.value.request]
          : [],
      )
      const signedTransactionHashes = new Map<number, string>()
      for (const { record, source } of signatureRespondedEvents) {
        for (const request of requests) {
          const check = checkSignature(mpcRootPublicKey, request, record)
          if (check.status === 'valid') {
            signedTransactionHashes.set(source.id, check.evmTransactionHash)
            break
          }
        }
      }
      const validSignatureResponseIds = new Set(signedTransactionHashes.keys())
      settle({ validSignatureResponseIds, attestationChecks: { status: 'loading' } })

      const callerAddress = signBidirectionalEvents[0]?.record.callerAddress
      if (callerAddress === undefined) {
        settle({ validSignatureResponseIds, attestationChecks: { status: 'no-notification' } })
        return
      }
      const execution = await recoverExecution(
        { ethereumMainnetRpcUrl, ethereumSepoliaRpcUrl },
        requests[0],
        [...new Set(signedTransactionHashes.values())],
      )
      settle({
        validSignatureResponseIds,
        attestationChecks: {
          status: 'checked',
          checks: new Map(
            lifecycle.respondBidirectionalEvents.map(({ record, source }) => [
              source.id,
              checkAttestation(mpcRootPublicKey, requestId, callerAddress, record, execution),
            ]),
          ),
        },
      })
    }
    void verify()
    return () => {
      current = false
    }
  }, [
    configKey,
    indexerUrl,
    mpcRootPublicKey,
    ethereumMainnetRpcUrl,
    ethereumSepoliaRpcUrl,
    lifecycle,
  ])

  // A verification made under another configuration is stale. One made for an earlier snapshot of
  // the lifecycle stays true for the events it covers, as an event's validity never changes.
  return settled?.configKey === configKey ? settled.verification : UNSETTLED
}
