import { CopyButton } from '@/components/copy-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { truncateMiddle } from '@/lib/format'

/** A long hex value, truncated, with its full form on hover and a button that copies it. */
export function CopyableHex({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger render={<span className="font-mono" />}>
          {truncateMiddle(value)}
        </TooltipTrigger>
        {/* The popup's default width cap is narrower than a 32-byte hex value, which cannot wrap. */}
        <TooltipContent className="max-w-none! font-mono">{value}</TooltipContent>
      </Tooltip>
      <CopyButton value={value} label={label} />
    </span>
  )
}
