import { Outlet, createFileRoute, redirect, retainSearchParams } from '@tanstack/react-router'
import { useEffect } from 'react'

import { MidnightAppBar } from '@/components/midnight/midnight-app-bar'
import { useMidnight } from '@/components/contexts/MidnightContext'
import { type MidnightNetwork, parseMidnightNetwork } from '@/lib/midnight/network'

interface MidnightSearch {
  networkId: MidnightNetwork
}

export const Route = createFileRoute('/midnight')({
  validateSearch: (search: Record<string, unknown>): MidnightSearch => ({
    networkId: parseMidnightNetwork(search.networkId),
  }),
  search: {
    middlewares: [retainSearchParams(['networkId'])],
  },
  // The validated search always names a network. When the raw query string does not spell it
  // out (absent or invalid), rewrite the URL so the address bar and the state agree.
  beforeLoad: ({ search, location }) => {
    const query = new URLSearchParams(location.searchStr)
    if (query.get('networkId') !== search.networkId) {
      query.set('networkId', search.networkId)
      throw redirect({ href: `${location.pathname}?${query.toString()}`, replace: true })
    }
  },
  component: MidnightLayout,
})

function MidnightLayout() {
  const { networkId } = Route.useSearch()
  const { setNetwork } = useMidnight()

  useEffect(() => {
    setNetwork(networkId)
  }, [networkId, setNetwork])

  return (
    <>
      <MidnightAppBar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">
        <Outlet />
      </main>
    </>
  )
}
