import type { ReactNode } from 'react'

import { InfoTooltip } from '@/components/info-tooltip'

/** A two column list of labelled values. Its children are {@link DetailLine}s. */
export function DetailList({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1">{children}</dl>
}

/** `info` explains the label in a tooltip, opened from an icon ahead of it. */
export function DetailLine({
  label,
  info,
  children,
}: {
  label: string
  info?: string
  children: ReactNode
}) {
  return (
    <>
      <dt className="inline-flex items-center gap-1 font-bold">
        {info !== undefined && <InfoTooltip label={`About ${label}`}>{info}</InfoTooltip>}
        {label}:
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}
