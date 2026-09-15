import { createFileRoute } from '@tanstack/react-router'

import { useMidnight } from '@/components/contexts/MidnightContext'

export const Route = createFileRoute('/midnight/contract-analyser')({
  component: ContractAnalyserPage,
})

function ContractAnalyserPage() {
  const { network } = useMidnight()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold">Contract Analyser</h1>
      <p className="text-muted-foreground">Midnight {network}</p>
    </div>
  )
}
