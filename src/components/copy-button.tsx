import { Check, Copy } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** How long the copy button shows its confirmation. */
const COPIED_FEEDBACK_MS = 1500

/**
 * Copies `value` to the clipboard. `label` names the value for assistive technology. `icon`
 * defaults to the copy icon, and `tooltip` adds a hover explanation.
 */
export function CopyButton({
  value,
  label,
  icon = <Copy />,
  tooltip,
}: {
  value: string
  label: string
  icon?: ReactNode
  tooltip?: string
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const timer = copied ? setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS) : null
    return () => {
      if (timer !== null) {
        clearTimeout(timer)
      }
    }
  }, [copied])

  const copy = () => {
    void navigator.clipboard.writeText(value).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  const shownIcon = copied ? <Check /> : icon
  const ariaLabel = copied ? `Copied ${label}` : `Copy ${label}`
  if (tooltip === undefined) {
    return (
      <Button variant="ghost" size="icon-xs" aria-label={ariaLabel} onClick={copy}>
        {shownIcon}
      </Button>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-xs" aria-label={ariaLabel} onClick={copy} />}
      >
        {shownIcon}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
