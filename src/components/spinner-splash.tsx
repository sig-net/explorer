import type { ReactNode } from 'react'

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'

/**
 * A spinner over `title`, centred in the space it is given, for work still under way. `spinnerLabel`
 * names the spinner to assistive technology, and `children` explain the work below the title.
 */
export function SpinnerSplash({
  spinnerLabel,
  title,
  children,
}: {
  spinnerLabel: string
  title: string
  children?: ReactNode
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Spinner aria-label={spinnerLabel} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {children !== undefined && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  )
}
