import { CornerDownLeft, X } from 'lucide-react'
import { useId, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { truncateMiddle } from '@/lib/format'
import { parseContractAddressHex } from '@/lib/midnight/contract-address'

/** A typed hex fragment as the SDK's lowercase hex, with any `0x` prefix and surrounding space dropped. */
function normaliseHexQuery(query: string): string {
  return query.trim().toLowerCase().replace(/^0x/, '')
}

/**
 * The callers whose requests are left out of the table. A caller is excluded by typing its address
 * and pressing Enter or the button beside the box, or by picking it from `callers`, the ones seen so
 * far, which the typed fragment narrows. Each excluded caller is a chip whose button lets it back in.
 */
export function ExcludedCallersFilter({
  callers,
  excluded,
  onChange,
}: {
  callers: readonly string[]
  excluded: readonly string[]
  onChange: (excluded: readonly string[]) => void
}) {
  const [inputValue, setInputValue] = useState('')
  const [invalid, setInvalid] = useState(false)
  const inputId = useId()
  const candidates = callers.filter((caller) => !excluded.includes(caller))
  const exclude = (caller: string) => {
    if (!excluded.includes(caller)) {
      onChange([...excluded, caller])
    }
    setInputValue('')
    setInvalid(false)
  }
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const caller = parseContractAddressHex(inputValue)
          if (caller === null) {
            setInvalid(true)
          } else {
            exclude(caller)
          }
        }}
      >
        <Label htmlFor={inputId}>Exclude callers</Label>
        <Combobox
          items={candidates}
          filter={(caller: string, query: string) => caller.includes(normaliseHexQuery(query))}
          value={null}
          onValueChange={(caller) => {
            if (caller !== null) {
              exclude(caller)
            }
          }}
          inputValue={inputValue}
          onInputValueChange={(value, details) => {
            // A picked item is a chip by now, and the box stays clear for the next one.
            if (details.reason !== 'item-press') {
              setInputValue(value)
              setInvalid(false)
            }
          }}
          autoHighlight
        >
          <ComboboxInput
            id={inputId}
            className="w-80 font-mono"
            placeholder="Caller contract address"
            aria-invalid={invalid || undefined}
            showTrigger={false}
          />
          <ComboboxContent className="w-max">
            <ComboboxEmpty>No seen caller matches</ComboboxEmpty>
            <ComboboxList>
              {(caller: string) => (
                <ComboboxItem key={caller} value={caller} className="font-mono text-xs">
                  {caller}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <Button type="submit" variant="outline" size="icon" aria-label="Exclude the typed caller">
          <CornerDownLeft />
        </Button>
      </form>
      {excluded.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1" aria-label="Excluded callers">
          {excluded.map((caller) => (
            <li key={caller}>
              <Badge variant="secondary" className="h-6 pr-0.5 font-mono" title={caller}>
                {truncateMiddle(caller)}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Stop excluding ${caller}`}
                  onClick={() => onChange(excluded.filter((other) => other !== caller))}
                >
                  <X />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
