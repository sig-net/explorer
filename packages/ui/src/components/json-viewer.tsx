import ReactJson from '@microlink/react-json-view'
import { Maximize2 } from 'lucide-react'

import { useTheme } from '@/components/contexts/ThemeContext'
import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from 'cn'

function JsonTree({ json }: { json: object }) {
  const { theme } = useTheme()
  return (
    <ReactJson
      src={json}
      name={false}
      theme={theme === 'dark' ? 'ocean' : 'rjv-default'}
      style={{ backgroundColor: 'transparent' }}
      displayDataTypes={false}
      displayObjectSize={false}
      enableClipboard={false}
      collapseStringsAfterLength={false}
    />
  )
}

/**
 * A JSON tree in a viewport that scrolls both ways and resizes vertically from its bottom right
 * corner. Its floating buttons copy the whole JSON and open it in a dialog sized to the window.
 * `name` is what the buttons say they act on, `title` and `description` head the dialog, and
 * `className` sets the viewport's starting height.
 */
export function JsonViewer({
  json,
  name,
  title,
  description,
  className,
}: {
  json: object
  name: string
  title: string
  description: string
  className?: string
}) {
  const copyButton = <CopyButton value={JSON.stringify(json, null, 2)} label={name} />
  return (
    // The bottom padding keeps the corner clear: a child lying over the browser's resize grip would
    // take its drag.
    <div
      className={cn(
        'bg-muted/50 relative h-72 min-h-32 resize-y overflow-hidden rounded-md border pb-3',
        className,
      )}
    >
      <ScrollArea className="h-full">
        <div className="w-max p-2">
          <JsonTree json={json} />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <Dialog>
        <div className="absolute right-3 bottom-6 flex gap-1 opacity-60 hover:opacity-100">
          {copyButton}
          <DialogTrigger
            render={<Button variant="ghost" size="icon-xs" aria-label={`Enlarge ${name}`} />}
          >
            <Maximize2 />
          </DialogTrigger>
        </div>
        <DialogContent className="flex h-[90vh] w-[90vw] flex-col sm:max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="relative min-h-0 flex-1">
            <ScrollArea className="bg-muted/50 h-full rounded-md border">
              <div className="w-max p-2">
                <JsonTree json={json} />
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <div className="absolute right-3 bottom-3 opacity-60 hover:opacity-100">
              {copyButton}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
