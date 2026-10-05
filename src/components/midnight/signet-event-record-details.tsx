import {
  bytesToHex,
  type MpcSignature,
  OutputKind,
  type RespondBidirectionalEvent,
  type SignatureRespondedEvent,
  type SignBidirectionalNotification,
} from '@sig-net/midnight'

import { CopyableHex } from '@/components/copyable-hex'
import { DetailLine, DetailList } from '@/components/detail-list'

/** Every field of a decoded V1 `SignBidirectionalEventNotification`. */
export function SignBidirectionalNotificationDetails({
  record,
}: {
  record: SignBidirectionalNotification
}) {
  return (
    <DetailList>
      <DetailLine label="Version">
        <span className="tabular-nums">{record.version}</span>
      </DetailLine>
      <DetailLine label="Caller">
        <CopyableHex value={record.callerAddress} label="caller address" />
      </DetailLine>
      <DetailLine label="Requests Path Depth">
        <span className="tabular-nums">{record.requestsPath.length}</span>
      </DetailLine>
      <DetailLine label="Requests Path">
        <span className="font-mono">[{record.requestsPath.join(', ')}]</span>
      </DetailLine>
    </DetailList>
  )
}

function RequestIdLine({ requestId }: { requestId: Uint8Array }) {
  return (
    <DetailLine label="Request Id">
      <CopyableHex value={bytesToHex(requestId)} label="request id" />
    </DetailLine>
  )
}

function MpcSignatureLines({ signature }: { signature: MpcSignature }) {
  return (
    <>
      <DetailLine label="Big R X">
        <CopyableHex value={bytesToHex(signature.bigR.x)} label="signature big R x" />
      </DetailLine>
      <DetailLine label="Big R Y">
        <CopyableHex value={bytesToHex(signature.bigR.y)} label="signature big R y" />
      </DetailLine>
      <DetailLine label="S">
        <CopyableHex value={bytesToHex(signature.s)} label="signature s" />
      </DetailLine>
      <DetailLine label="Recovery Id">
        <span className="tabular-nums">{signature.recoveryId.toString()}</span>
      </DetailLine>
    </>
  )
}

/** Every field of a decoded `SignatureRespondedEvent`. */
export function SignatureRespondedEventDetails({ record }: { record: SignatureRespondedEvent }) {
  return (
    <DetailList>
      <RequestIdLine requestId={record.requestId} />
      <MpcSignatureLines signature={record.signature} />
    </DetailList>
  )
}

const OUTPUT_KIND_LABELS: Record<OutputKind, string> = {
  [OutputKind.executed]: 'Executed',
  [OutputKind.failed]: 'Failed',
  [OutputKind.unviable]: 'Unviable',
}

/** Every field of a decoded `RespondBidirectionalEvent`. */
export function RespondBidirectionalEventDetails({
  record,
}: {
  record: RespondBidirectionalEvent
}) {
  return (
    <DetailList>
      <RequestIdLine requestId={record.requestId} />
      <DetailLine
        label="Destination Block"
        info="Height of the finalised block on the destination chain that holds the attested transaction."
      >
        <span className="tabular-nums">{record.blockHeight.toString()}</span>
      </DetailLine>
      <DetailLine
        label="Output Kind"
        info="The MPC's verdict on the execution. Executed: finalised and succeeded. Failed: finalised and reverted. Unviable: another finalised transaction took the nonce."
      >
        {OUTPUT_KIND_LABELS[record.outputKind]}
      </DetailLine>
      <DetailLine
        label="Output Length"
        info="Byte width of the serialised output the digest commits to. The bytes themselves travel off chain."
      >
        <span className="tabular-nums">{record.serializedOutputLength.toString()}</span>
      </DetailLine>
      <DetailLine label="Digest" info="The attestation digest the signature is over.">
        <CopyableHex value={bytesToHex(record.digest)} label="attestation digest" />
      </DetailLine>
      <MpcSignatureLines signature={record.signature} />
    </DetailList>
  )
}
