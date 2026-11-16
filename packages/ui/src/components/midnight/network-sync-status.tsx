import type { ExplorerNetwork } from '@sig-net/explorer-api'
import { CircleAlert } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatLocalTimestamp } from '@/lib/format'

/** How far the backend has indexed `served`, and in which state. */
export function NetworkSyncStatus({ served }: { served: ExplorerNetwork }) {
  const { state, processedBlock, processedBlockTime } = served.sync
  if (state === 'starting' || processedBlock === null) {
    return <p className="text-muted-foreground text-sm">Nothing indexed yet ({state})</p>
  }
  const time = processedBlockTime === null ? '' : ` at ${formatLocalTimestamp(processedBlockTime)}`
  return (
    <p className="text-muted-foreground text-sm">
      Indexed to block {String(processedBlock)}
      {time} ({state})
    </p>
  )
}

/** The backend's reason, while it has stopped indexing `served` or its latest read failed. */
export function NetworkSyncAlert({ served }: { served: ExplorerNetwork }) {
  const { state, error } = served.sync
  if (state !== 'stopped' && error === null) {
    return null
  }
  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertTitle>
        {state === 'stopped'
          ? `The backend stopped indexing ${served.network}`
          : `The backend's latest read of ${served.network} failed`}
      </AlertTitle>
      <AlertDescription>
        <p>{error ?? 'The backend gave no reason.'}</p>
      </AlertDescription>
    </Alert>
  )
}
