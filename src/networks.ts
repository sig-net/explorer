import { notFound } from '@tanstack/react-router'

export const NETWORK_IDS = ['midnight', 'solana'] as const

export type NetworkId = (typeof NETWORK_IDS)[number]

export interface Network {
  id: NetworkId
  label: string
  /** Icon shown on light backgrounds. */
  lightIcon: string
  /** Icon shown on dark backgrounds. */
  darkIcon: string
}

export const NETWORKS: Record<NetworkId, Network> = {
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    lightIcon: '/icons/Midnight-black.svg',
    darkIcon: '/icons/Midnight-white.svg',
  },
  solana: {
    id: 'solana',
    label: 'Solana',
    lightIcon: '/icons/Solana.svg',
    darkIcon: '/icons/Solana.svg',
  },
}

export function isNetworkId(value: string): value is NetworkId {
  return NETWORK_IDS.some((id) => id === value)
}

/** Narrows a raw path segment to a network id, or throws the router's not-found signal. */
export function parseNetworkId(value: string): NetworkId {
  if (isNetworkId(value)) {
    return value
  }
  throw notFound()
}
