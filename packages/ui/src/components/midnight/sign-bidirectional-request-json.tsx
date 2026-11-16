import type { SignBidirectionalEvent } from '@sig-net/midnight'

import { JsonViewer } from '@/components/json-viewer'
import { signBidirectionalEventJson } from '@/lib/midnight/sign-bidirectional-event-json'

/** A request record as a JSON tree. */
export function SignBidirectionalRequestJson({ request }: { request: SignBidirectionalEvent }) {
  return (
    <JsonViewer
      json={signBidirectionalEventJson(request)}
      name="request JSON"
      title="Request at Path in Caller"
      description="The request record the transaction stored."
      className="h-36"
    />
  )
}
