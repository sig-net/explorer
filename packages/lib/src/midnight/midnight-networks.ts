import { MidnightNetwork } from '@sig-net/midnight'

export const MIDNIGHT_NETWORKS: readonly MidnightNetwork[] = [
  MidnightNetwork.Undeployed,
  MidnightNetwork.Preview,
  MidnightNetwork.Preprod,
  MidnightNetwork.Mainnet,
]

export function isMidnightNetwork(value: unknown): value is MidnightNetwork {
  return typeof value === 'string' && MIDNIGHT_NETWORK_VALUES.includes(value)
}

// Widened to plain strings so a raw value can be tested without comparing across enum types.
const MIDNIGHT_NETWORK_VALUES: readonly string[] = MIDNIGHT_NETWORKS
