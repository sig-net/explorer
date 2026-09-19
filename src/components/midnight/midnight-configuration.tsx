import { useLocation, useNavigate } from '@tanstack/react-router'
import { Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMidnight } from '@/components/contexts/MidnightContext'
import { MidnightNetwork } from '@sig-net/midnight'
import {
  MIDNIGHT_NETWORKS,
  type MidnightNetworkConfig,
  parseMpcRootPublicKey,
  parseSignetContractAddress,
} from '@/lib/midnight/network'

interface ConfigField {
  key: keyof MidnightNetworkConfig
  label: string
  /** Names what is wrong with a non-empty value, or null when it is acceptable. */
  problem?: (value: string) => string | null
}

const CONFIG_FIELDS: readonly ConfigField[] = [
  { key: 'indexerUrl', label: 'Indexer URL' },
  { key: 'indexerWsUrl', label: 'Indexer WebSocket URL' },
  { key: 'nodeUrl', label: 'Node URL' },
  {
    key: 'mpcRootPublicKey',
    label: 'MPC Root Public Key',
    problem: (value) =>
      parseMpcRootPublicKey(value) === null
        ? 'Expected a secp256k1 public key: SEC1 hex or secp256k1:<base58>.'
        : null,
  },
  {
    key: 'signetContractAddress',
    label: 'Signet Contract Address',
    problem: (value) =>
      parseSignetContractAddress(value) === null ? 'Expected 32 bytes of hex (64 digits).' : null,
  },
  { key: 'ethereumMainnetRpcUrl', label: 'Ethereum Mainnet RPC URL' },
  { key: 'ethereumSepoliaRpcUrl', label: 'Ethereum Sepolia RPC URL' },
]

export function MidnightConfiguration() {
  const navigate = useNavigate()
  const { pathname, searchStr } = useLocation()
  const { network, config, isDefaultConfig, setConfig, resetDefaults } = useMidnight()

  // The URL owns the selected network and the route layout copies it into the context, so
  // selecting here rewrites the query string of whichever Midnight page is open.
  const selectNetwork = (next: MidnightNetwork | null) => {
    if (next !== null && next !== network) {
      const query = new URLSearchParams(searchStr)
      query.set('networkId', next)
      void navigate({ href: `${pathname}?${query.toString()}` })
    }
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={<Button variant="ghost" size="icon" aria-label="Midnight configuration" />}
            />
          }
        >
          <Settings />
        </TooltipTrigger>
        <TooltipContent>Midnight configuration</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-96">
        <PopoverHeader>
          <PopoverTitle>Midnight configuration</PopoverTitle>
        </PopoverHeader>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="midnight-network">Network</Label>
            <Select<MidnightNetwork> value={network} onValueChange={selectNetwork}>
              <SelectTrigger id="midnight-network" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MIDNIGHT_NETWORKS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {CONFIG_FIELDS.map(({ key, label, problem }) => {
            const message = config[key] === '' ? null : (problem?.(config[key]) ?? null)
            return (
              <div key={key} className="flex flex-col gap-2">
                <Label htmlFor={`midnight-${key}`}>{label}</Label>
                <Input
                  id={`midnight-${key}`}
                  value={config[key]}
                  aria-invalid={message !== null}
                  aria-describedby={message === null ? undefined : `midnight-${key}-problem`}
                  onChange={(event) => setConfig({ [key]: event.target.value })}
                />
                {message !== null && (
                  <p id={`midnight-${key}-problem`} className="text-destructive text-xs">
                    {message}
                  </p>
                )}
              </div>
            )
          })}
          <Button variant="outline" disabled={isDefaultConfig} onClick={resetDefaults}>
            Reset Defaults
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
