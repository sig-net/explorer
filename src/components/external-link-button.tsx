import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Opens `href` in a new tab. `label` is the tooltip and names the link for assistive technology.
 * `icon` defaults to the external-link arrow.
 */
export function ExternalLinkButton({
  href,
  label,
  icon = <ExternalLink />,
}: {
  href: string
  label: string
  icon?: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            nativeButton={false}
            aria-label={label}
            render={<a href={href} target="_blank" rel="noreferrer" />}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
