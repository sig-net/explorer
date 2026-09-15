import type { Network } from '@/lib/networks'

export function NetworkIcon({ network, className }: { network: Network; className?: string }) {
  return (
    <>
      <img
        src={network.lightIcon}
        alt=""
        aria-hidden
        className={`dark:hidden ${className ?? ''}`}
      />
      <img
        src={network.darkIcon}
        alt=""
        aria-hidden
        className={`hidden dark:block ${className ?? ''}`}
      />
    </>
  )
}
