import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

/** How long the copy button shows its confirmation. */
const COPIED_FEEDBACK_MS = 1500

/** Copies `value` to the clipboard. `label` names the value for assistive technology. */
export function CopyButton({ value, label }: { value: string; label: string }) {
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
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      onClick={copy}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}
