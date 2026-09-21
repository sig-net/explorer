import { createFileRoute, Link } from '@tanstack/react-router'
import { FileSearch } from 'lucide-react'

import { useMidnight } from '@/components/contexts/MidnightContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export const Route = createFileRoute('/midnight/contract-analyser')({
  component: ContractAnalyserPage,
})

function ContractAnalyserPage() {
  const { network } = useMidnight()
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-16 rounded-2xl [&_svg:not([class*='size-'])]:size-8"
        >
          <FileSearch />
        </EmptyMedia>
        <Badge variant="secondary">Coming soon</Badge>
        <EmptyTitle className="text-2xl">Contract Analyser</EmptyTitle>
        <EmptyDescription className="text-base">
          The Contract Analyser for Midnight {network} is not available yet.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link to="/midnight/explorer" search={{ networkId: network }} />}
        >
          Back to the Explorer
        </Button>
      </EmptyContent>
    </Empty>
  )
}
