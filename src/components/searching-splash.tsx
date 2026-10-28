import type { ReactNode } from 'react'

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'

/**
 * A spinner over `title`, centred in the space it is given, for a search still under way. `children`
 * explain the search below the title.
 */
export function SearchingSplash({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Spinner aria-label="Searching" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {children !== undefined && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  )
}
