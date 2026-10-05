import { bytesToHex, OutputKind } from '@sig-net/midnight'
import { CircleCheck, CircleHelp, CircleX } from 'lucide-react'

import { CopyableHex } from '@/components/copyable-hex'
import { InfoTooltip } from '@/components/info-tooltip'
import { JsonViewer } from '@/components/json-viewer'
import type { AttestationChecksState } from '@/components/midnight/use-lifecycle-verification'
import { PendingIcon } from '@/components/pending-icon'
import type {
  AttestationCheck as AttestationCheckResult,
  AttestedOutputSource,
} from '@/lib/midnight/attestation-check'
import { attestedOutputJson } from '@/lib/midnight/attested-output-json'

const SUCCESS = 'text-success-600 dark:text-success-400'

const OUTPUT_SOURCE_LABELS: Record<AttestedOutputSource, string> = {
  'mpc-cache': 'the MPC output cache',
  'evm-node': 'a trace of the transaction on the EVM node',
}

function ResponseKey({ responseKey }: { responseKey: string }) {
  return (
    <>
      <CopyableHex value={responseKey} label="response key" />
      <InfoTooltip label="About the response key">
        The secp256k1 public key the MPC signs this contract's execution attestations with. The MPC
        derives it from its root public key, the requesting contract's address and the reserved path
        "midnight response key", so it is fixed for the contract: responseKey =
        f(mpcRootKey[keyVersion], "midnight:mainnet", contractAddress, "midnight response key"). The
        contract pins it after deploy and verifies every attestation against it in-circuit.
      </InfoTooltip>
    </>
  )
}

function SerializedOutput({ serializedOutput }: { serializedOutput: Uint8Array | null }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="font-bold">Attested Bytes:</span>
      {serializedOutput === null || serializedOutput.length === 0 ? (
        <span className="text-muted-foreground">none</span>
      ) : (
        <CopyableHex value={bytesToHex(serializedOutput)} label="attested bytes" />
      )}
      <InfoTooltip label="About the attested bytes">
        The serialised output the attestation is over. The event carries its width and digest, never
        the bytes, so they are obtained here: from the MPC's output cache, or rebuilt from the
        transaction's return data, decoded by the request's output deserialisation schema and Borsh
        serialised. An attestation that declares a width of zero is over no bytes, so nothing is
        obtained for it.
      </InfoTooltip>
    </span>
  )
}

function verdict(outputKind: OutputKind, blockHeight: bigint): string {
  const block = `destination block ${blockHeight.toString()}`
  switch (outputKind) {
    case OutputKind.executed:
      return `The MPC attests that the foreign transaction executed, finalised in ${block}.`
    case OutputKind.failed:
      return `The MPC attests that the foreign transaction reverted, finalised in ${block}, so there is no output.`
    case OutputKind.unviable:
      return `The MPC attests that another transaction, finalised in ${block}, took the request's nonce, so the requested transaction cannot execute and there is no output.`
    default: {
      const exhaustive: never = outputKind
      throw new Error(`unhandled output kind ${String(exhaustive)}`)
    }
  }
}

function Check({ check }: { check: AttestationCheckResult }) {
  switch (check.status) {
    case 'no-root-key':
      return (
        <p className="text-muted-foreground">
          Needs a valid MPC root public key in the configuration
        </p>
      )
    case 'valid':
      return (
        <>
          <span className={`inline-flex flex-wrap items-center gap-1 ${SUCCESS}`}>
            <CircleCheck className="size-4" />
            valid for response key
            <ResponseKey responseKey={check.responseKey} />
          </span>
          <p className="text-muted-foreground">{verdict(check.outputKind, check.blockHeight)}</p>
          <SerializedOutput serializedOutput={check.output?.serializedOutput ?? null} />
          {check.output !== null && (
            <span className="flex flex-wrap items-center gap-1">
              <span className="font-bold">Output Source:</span>
              {OUTPUT_SOURCE_LABELS[check.output.source]}
            </span>
          )}
          {check.output !== null && check.output.decodedOutput !== null && (
            <>
              <h4 className="font-bold">Recovered Output</h4>
              <JsonViewer
                json={attestedOutputJson(check.output.decodedOutput)}
                name="recovered output JSON"
                title="Recovered Output"
                description="The foreign transaction's return data, decoded by the request's output deserialisation schema."
                className="h-32 min-h-24"
              />
            </>
          )}
        </>
      )
    case 'invalid':
      return (
        <>
          <span className="text-destructive inline-flex flex-wrap items-center gap-1">
            <CircleX className="size-4" />
            not valid for response key
            <ResponseKey responseKey={check.responseKey} />
          </span>
          <p className="text-muted-foreground">{check.reason}</p>
        </>
      )
    case 'unverified':
      return (
        <>
          <span className="inline-flex flex-wrap items-center gap-1">
            <CircleHelp className="size-4" />
            not checked against response key
            <ResponseKey responseKey={check.responseKey} />
          </span>
          <p className="text-muted-foreground">
            The attestation declares output bytes, and they could not be obtained to check it
            against: {check.reason}. The output is read from the MPC's output cache, else recovered
            with debug_traceTransaction, which many hosted nodes gate, so set an RPC endpoint that
            serves it in the configuration.
          </p>
        </>
      )
    default: {
      const exhaustive: never = check
      throw new Error(`unhandled attestation check ${String(exhaustive)}`)
    }
  }
}

/** Whether one posted attestation is by the requesting contract's response key, and over what. */
export function AttestationCheck({
  checks,
  eventId,
}: {
  checks: AttestationChecksState
  eventId: number
}) {
  const check = checks.status === 'checked' ? checks.checks.get(eventId) : undefined
  return (
    <>
      <h4 className="font-bold">Attestation Check</h4>
      {checks.status === 'no-notification' ? (
        <p className="text-muted-foreground">No sign bidirectional notification to check against</p>
      ) : check === undefined ? (
        <PendingIcon />
      ) : (
        <Check check={check} />
      )}
    </>
  )
}
