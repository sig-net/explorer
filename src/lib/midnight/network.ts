export const MidnightNetwork = {
  Undeployed: 'undeployed',
  Stagenet: 'stagenet',
  Preview: 'preview',
  Preprod: 'preprod',
  Mainnet: 'mainnet',
} as const

export type MidnightNetwork = (typeof MidnightNetwork)[keyof typeof MidnightNetwork]

export const MIDNIGHT_NETWORKS: readonly MidnightNetwork[] = [
  MidnightNetwork.Undeployed,
  MidnightNetwork.Stagenet,
  MidnightNetwork.Preview,
  MidnightNetwork.Preprod,
  MidnightNetwork.Mainnet,
]

export const DEFAULT_MIDNIGHT_NETWORK: MidnightNetwork = MidnightNetwork.Stagenet

export interface MidnightNetworkConfig {
  indexerUrl: string
  indexerWsUrl: string
  nodeUrl: string
}

export const MIDNIGHT_NETWORK_DEFAULTS: Record<MidnightNetwork, MidnightNetworkConfig> = {
  [MidnightNetwork.Undeployed]: {
    indexerUrl: 'http://127.0.0.1:8088/api/v3/graphql',
    indexerWsUrl: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
    nodeUrl: 'http://127.0.0.1:9944',
  },
  // Stagenet serves the v4 indexer API, so its paths differ from the v3 paths of the
  // *.midnight.network networks below.
  [MidnightNetwork.Stagenet]: {
    indexerUrl: 'https://indexer.stagenet.shielded.tools/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.stagenet.shielded.tools/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.stagenet.shielded.tools',
  },
  [MidnightNetwork.Preview]: {
    indexerUrl: 'https://indexer.preview.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
    nodeUrl: 'https://rpc.preview.midnight.network',
  },
  [MidnightNetwork.Preprod]: {
    indexerUrl: 'https://indexer.preprod.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
    nodeUrl: 'https://rpc.preprod.midnight.network',
  },
  [MidnightNetwork.Mainnet]: {
    indexerUrl: 'https://indexer.mainnet.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.mainnet.midnight.network/api/v3/graphql/ws',
    nodeUrl: 'https://rpc.mainnet.midnight.network',
  },
}

export function isMidnightNetwork(value: unknown): value is MidnightNetwork {
  return typeof value === 'string' && MIDNIGHT_NETWORKS.some((network) => network === value)
}

/** Narrows a raw search-param value to a network, falling back to the default. */
export function parseMidnightNetwork(value: unknown): MidnightNetwork {
  return isMidnightNetwork(value) ? value : DEFAULT_MIDNIGHT_NETWORK
}
