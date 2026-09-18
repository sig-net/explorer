import {
  bytesToHex,
  type MpcSignature,
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

function MpcSignatureDetails({ signature }: { signature: MpcSignature }) {
  return (
    <DetailList>
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
    </DetailList>
  )
}

/** Every field of a decoded `SignatureRespondedEvent`. */
export function SignatureRespondedEventDetails({ record }: { record: SignatureRespondedEvent }) {
  return <MpcSignatureDetails signature={record.signature} />
}

/** Every field of a decoded `RespondBidirectionalEvent`. */
export function RespondBidirectionalEventDetails({
  record,
}: {
  record: RespondBidirectionalEvent
}) {
  return <MpcSignatureDetails signature={record.signature} />
}
