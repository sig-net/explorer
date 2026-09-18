import type { ReactNode } from 'react'

/** A two column list of labelled values. Its children are {@link DetailLine}s. */
export function DetailList({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1">{children}</dl>
}

export function DetailLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-bold">{label}:</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}
