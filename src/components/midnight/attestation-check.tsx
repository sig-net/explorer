import { bytesToHex } from '@sig-net/midnight'
import { CircleCheck, CircleHelp, CircleX } from 'lucide-react'

import { CopyableHex } from '@/components/copyable-hex'
import { InfoTooltip } from '@/components/info-tooltip'
import { JsonViewer } from '@/components/json-viewer'
import type { AttestationChecksState } from '@/components/midnight/use-lifecycle-verification'
import { PendingIcon } from '@/components/pending-icon'
import type { AttestationCheck as AttestationCheckResult } from '@/lib/midnight/attestation-check'
import { attestedOutputJson } from '@/lib/midnight/attested-output-json'

const SUCCESS = 'text-success-600 dark:text-success-400'

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

function SerializedOutput({ serializedOutput }: { serializedOutput: Uint8Array }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="font-bold">Attested Bytes:</span>
      <CopyableHex value={bytesToHex(serializedOutput)} label="attested bytes" />
      <InfoTooltip label="About the attested bytes">
        The serialised output the attestation is over. Only the signature travels on chain, so these
        bytes are rebuilt here: the transaction's return data, decoded by the request's output
        deserialisation schema and packed by its respond serialisation schema.
      </InfoTooltip>
    </span>
  )
}

function Check({ check }: { check: AttestationCheckResult }) {
  switch (check.status) {
    case 'no-root-key':
      return (
        <p className="text-muted-foreground">
          Needs a valid MPC root public key in the configuration
        </p>
      )
    case 'valid-success':
      return (
        <>
          <span className={`inline-flex flex-wrap items-center gap-1 ${SUCCESS}`}>
            <CircleCheck className="size-4" />
            valid for response key
            <ResponseKey responseKey={check.responseKey} />
          </span>
          <SerializedOutput serializedOutput={check.serializedOutput} />
          <h4 className="font-bold">Recovered Output</h4>
          <JsonViewer
            json={attestedOutputJson(check.decodedOutput)}
            name="recovered output JSON"
            title="Recovered Output"
            description="The foreign transaction's return data, decoded by the request's output deserialisation schema."
            className="h-32 min-h-24"
          />
        </>
      )
    case 'valid-failure':
      return (
        <>
          <span className={`inline-flex flex-wrap items-center gap-1 ${SUCCESS}`}>
            <CircleCheck className="size-4" />
            valid for response key
            <ResponseKey responseKey={check.responseKey} />
          </span>
          <SerializedOutput serializedOutput={check.serializedOutput} />
          <p className="text-muted-foreground">
            These are the MPC's fixed failure payload: it attests that the foreign transaction
            failed, so there is no output.
          </p>
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
            The attestation is not over the failure payload, and the foreign transaction's output
            could not be recovered to check it against: {check.reason}. Recovery reads it with
            debug_traceTransaction, which many hosted nodes gate, so set an RPC endpoint that serves
            it in the configuration.
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
