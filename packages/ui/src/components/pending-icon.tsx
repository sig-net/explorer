import { Clock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const ICON_CLASS_NAME = 'text-muted-foreground size-4'

/**
 * A clock marking something that has not arrived. With `tooltip`, hovering or focusing the clock
 * explains what is being waited for.
 */
export function PendingIcon({ tooltip }: { tooltip?: string }) {
  if (tooltip === undefined) {
    return <Clock role="img" aria-label="Pending" className={ICON_CLASS_NAME} />
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Pending" />}>
        <Clock className={ICON_CLASS_NAME} />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
