import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Opens `href` in a new tab. `label` is the tooltip and names the link for assistive technology. */
export function ExternalLinkButton({ href, label }: { href: string; label: string }) {
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
        <ExternalLink />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
