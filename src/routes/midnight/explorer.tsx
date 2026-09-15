import { createFileRoute } from '@tanstack/react-router'

import { useMidnight } from '@/components/contexts/MidnightContext'

export const Route = createFileRoute('/midnight/explorer')({
  component: ExplorerPage,
})

function ExplorerPage() {
  const { network } = useMidnight()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold">Explorer</h1>
      <p className="text-muted-foreground">Midnight {network}</p>
    </div>
  )
}
