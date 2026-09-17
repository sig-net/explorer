import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { truncateMiddle } from '@/lib/format'

/** How long the copy button shows its confirmation. */
const COPIED_FEEDBACK_MS = 1500

/** A long hex value, truncated, with its full form on hover and a button that copies it. */
export function CopyableHex({ value, label }: { value: string; label: string }) {
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

  return (
    <span className="inline-flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger render={<span className="font-mono" />}>
          {truncateMiddle(value)}
        </TooltipTrigger>
        {/* The popup's default width cap is narrower than a 32-byte hex value, which cannot wrap. */}
        <TooltipContent className="max-w-none! font-mono">{value}</TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
        onClick={copy}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </span>
  )
}
