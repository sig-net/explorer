import { createFileRoute } from '@tanstack/react-router'

import { NETWORKS, parseNetworkId } from '@/networks'

export const Route = createFileRoute('/$network')({
  params: {
    parse: ({ network }) => ({ network: parseNetworkId(network) }),
    stringify: ({ network }) => ({ network }),
  },
  component: NetworkPage,
})

function NetworkPage() {
  const { network } = Route.useParams()
  return (
    <div className="flex flex-1 items-center justify-center">
      <h1 className="text-2xl font-semibold">{NETWORKS[network].label}</h1>
    </div>
  )
}
