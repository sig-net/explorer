import { useLocation, useNavigate } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'

import { NetworkIcon } from '@/components/network-icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NETWORK_IDS, NETWORKS, type Network, networkFromPathname } from '@/lib/networks'

export function NetworkSwitcher() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const current = networkFromPathname(pathname)

  const select = (network: Network) => {
    void navigate({ to: network.route })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="min-w-40 justify-between" />}
      >
        <span className="flex items-center gap-2">
          {current === null ? (
            <span className="text-muted-foreground">Select network</span>
          ) : (
            <>
              <NetworkIcon network={current} className="size-4" />
              {current.label}
            </>
          )}
        </span>
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {NETWORK_IDS.map((id) => {
          const network = NETWORKS[id]
          return (
            <DropdownMenuItem key={id} onClick={() => select(network)}>
              <NetworkIcon network={network} className="size-4" />
              {network.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
