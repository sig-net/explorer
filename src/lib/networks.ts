export const NETWORK_IDS = ['midnight', 'solana'] as const

export type NetworkId = (typeof NETWORK_IDS)[number]

export interface Network {
  id: NetworkId
  label: string
  /** Root route of the network's pages. */
  route: '/midnight' | '/solana'
  /** Icon shown on light backgrounds. */
  lightIcon: string
  /** Icon shown on dark backgrounds. */
  darkIcon: string
}

export const NETWORKS: Record<NetworkId, Network> = {
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    route: '/midnight',
    lightIcon: '/icons/Midnight-black.svg',
    darkIcon: '/icons/Midnight-white.svg',
  },
  solana: {
    id: 'solana',
    label: 'Solana',
    route: '/solana',
    lightIcon: '/icons/Solana.svg',
    darkIcon: '/icons/Solana.svg',
  },
}

export function isNetworkId(value: string): value is NetworkId {
  return NETWORK_IDS.some((id) => id === value)
}

/** The network whose route owns the given pathname, if any. */
export function networkFromPathname(pathname: string): Network | null {
  const [, first = ''] = pathname.split('/')
  return isNetworkId(first) ? NETWORKS[first] : null
}
