import { Rewind } from 'lucide-react'
import { useId, useState } from 'react'

import type { SignetStartingBlock } from '@/components/contexts/MidnightSignetEventsContext'
import { InfoTooltip } from '@/components/info-tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { parseSignetEventsFromBlock } from '@/lib/midnight/network'
import {
  DEFAULT_SIGNET_EVENTS_WINDOW_DAYS,
  midnightBlocksIn,
  SIGNET_EVENTS_STEP_BACK_DAYS,
  signetEventsFromBlockSteppedBack,
} from '@/lib/midnight/signet-events-window'

const WINDOW_BLOCKS = midnightBlocksIn(DEFAULT_SIGNET_EVENTS_WINDOW_DAYS).toLocaleString('en-GB')
const STEP_BLOCKS = midnightBlocksIn(SIGNET_EVENTS_STEP_BACK_DAYS).toLocaleString('en-GB')

/**
 * The block the Signet contract's events are read from: shown as resolved, editable, and with a
 * step half a day of blocks back. An edit reaches `onChange` on Enter or blur, as the typed text,
 * once it is a block height or empty.
 */
export function SignetEventsStartingBlock({
  startingBlock,
  onChange,
}: {
  startingBlock: SignetStartingBlock
  onChange: (value: string) => void
}) {
  const id = useId()
  const resolved = startingBlock.status === 'resolved' ? startingBlock.block : null
  // Null while the field shows the resolved block, a string while it is being edited.
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (resolved === null ? '' : String(resolved))
  const draftIsInvalid = draft !== null && parseSignetEventsFromBlock(draft) === null
  const commit = () => {
    if (draft === null) {
      return
    }
    if (parseSignetEventsFromBlock(draft) !== null) {
      onChange(draft.trim())
      setDraft(null)
    }
  }
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={id} className="text-muted-foreground text-sm">
        Starting Block
      </Label>
      <InfoTooltip label="About the starting block">
        The lowest block the Signet contract's events are read from. By default it is{' '}
        {String(DEFAULT_SIGNET_EVENTS_WINDOW_DAYS)} days of blocks (about {WINDOW_BLOCKS}) before
        the chain's tip when the page loaded, and never before the earliest block listed for the
        contract. Enter a block height to read from it, 0 for the whole history, or nothing for the
        default. It is the Signet Events From Block field of the Midnight configuration.
      </InfoTooltip>
      <Input
        id={id}
        className="bg-card dark:bg-card w-28 tabular-nums"
        inputMode="numeric"
        value={shown}
        placeholder={startingBlock.status === 'resolving' ? 'reading tip' : ''}
        aria-invalid={draftIsInvalid}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit()
          }
        }}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="Read from half a day of blocks earlier"
              disabled={resolved === null || resolved === 0}
              onClick={() => {
                if (resolved !== null) {
                  setDraft(null)
                  onChange(String(signetEventsFromBlockSteppedBack(resolved)))
                }
              }}
            />
          }
        >
          <Rewind />
        </TooltipTrigger>
        <TooltipContent>
          Read from half a day of blocks (about {STEP_BLOCKS}) earlier than the starting block
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
