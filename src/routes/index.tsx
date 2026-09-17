import { createFileRoute, redirect } from '@tanstack/react-router'

import { DEFAULT_MIDNIGHT_NETWORK } from '@/lib/midnight/network'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({
      to: '/midnight',
      search: { networkId: DEFAULT_MIDNIGHT_NETWORK },
      replace: true,
    })
  },
})
