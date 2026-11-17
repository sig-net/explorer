import {
  getResponderContractAddress,
  getSignerContractAddress,
  MidnightNetwork,
} from '@sig-net/midnight'
import { describe, expect, it } from 'vitest'

import {
  type BackendEnv,
  EXPLORER_DEFAULT_MAX_RANGE_BLOCKS,
  EXPLORER_DEFAULT_POLL_INTERVAL_SECONDS,
  EXPLORER_DEFAULT_TIP_MARGIN_BLOCKS,
  parseBackendEnv,
} from './backend-env.ts'

const SIGNER = '11'.repeat(32)
const RESPONDER = '22'.repeat(32)

const MINIMAL_PREPROD_ENV: BackendEnv = {
  EXPLORER_DATABASE_URL: 'postgres://explorer:pw@127.0.0.1:5432/explorer',
  EXPLORER_CORS_ORIGINS: '*',
  EXPLORER_MIDNIGHT_NETWORKS: 'preprod',
  EXPLORER_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID: 'preprodAb+1/',
}

function failureOf(env: BackendEnv): string {
  try {
    parseBackendEnv(env)
  } catch (error) {
    if (error instanceof Error) {
      return error.message
    }
  }
  throw new Error('the environment was accepted')
}

describe('parseBackendEnv', () => {
  it('parses a full environment', () => {
    const config = parseBackendEnv({
      EXPLORER_DATABASE_URL: 'postgresql://explorer:pw@db:5432/explorer',
      EXPLORER_HOST: '127.0.0.1',
      EXPLORER_PORT: '9000',
      EXPLORER_CORS_ORIGINS: 'https://sig-net.github.io, http://localhost:5173',
      EXPLORER_MIDNIGHT_NETWORKS: 'preview,undeployed',
      EXPLORER_MIDNIGHT_PREVIEW_INDEXER_URL: 'https://indexer.preview.test/api/v4/graphql?key=k',
      EXPLORER_MIDNIGHT_PREVIEW_SIGNER_CONTRACT_ADDRESS: `0x${SIGNER.toUpperCase()}`,
      EXPLORER_MIDNIGHT_PREVIEW_RESPONDER_CONTRACT_ADDRESS: RESPONDER,
      EXPLORER_MIDNIGHT_PREVIEW_START_BLOCK: '12',
      EXPLORER_MIDNIGHT_UNDEPLOYED_INDEXER_URL: 'http://127.0.0.1:8088/api/v4/graphql',
      EXPLORER_MIDNIGHT_UNDEPLOYED_SIGNER_CONTRACT_ADDRESS: SIGNER,
      EXPLORER_MIDNIGHT_UNDEPLOYED_RESPONDER_CONTRACT_ADDRESS: RESPONDER,
      EXPLORER_MIDNIGHT_UNDEPLOYED_START_BLOCK: '0',
      EXPLORER_POLL_INTERVAL_SECONDS: '60',
      EXPLORER_TIP_MARGIN_BLOCKS: '0',
      EXPLORER_MAX_RANGE_BLOCKS: '500',
    })
    const timing = { pollIntervalSeconds: 60, tipMargin: 0, maxRange: 500 }
    expect(config).toEqual({
      databaseUrl: 'postgresql://explorer:pw@db:5432/explorer',
      host: '127.0.0.1',
      port: 9000,
      corsOrigins: ['https://sig-net.github.io', 'http://localhost:5173'],
      networks: [
        {
          network: MidnightNetwork.Preview,
          config: {
            signerContractAddress: SIGNER,
            responderContractAddress: RESPONDER,
            startBlock: 12,
            sourceUrl: 'https://indexer.preview.test/api/v4/graphql?key=k',
          },
          ...timing,
        },
        {
          network: MidnightNetwork.Undeployed,
          config: {
            signerContractAddress: SIGNER,
            responderContractAddress: RESPONDER,
            startBlock: 0,
            sourceUrl: 'http://127.0.0.1:8088/api/v4/graphql',
          },
          ...timing,
        },
      ],
    })
    expect(Object.isFrozen(config)).toBe(true)
    expect(Object.isFrozen(config.corsOrigins)).toBe(true)
    expect(Object.isFrozen(config.networks)).toBe(true)
    expect(config.networks.every((network) => Object.isFrozen(network))).toBe(true)
    expect(config.networks.every(({ config: network }) => Object.isFrozen(network))).toBe(true)
  })

  it('names the variable that is missing or invalid and prints no value', () => {
    const invalid: BackendEnv = {
      EXPLORER_DATABASE_URL: 'mysql://secret-db-value',
      EXPLORER_HOST: 'secret host',
      EXPLORER_PORT: '70000secret',
      EXPLORER_CORS_ORIGINS: 'https://secret-origin.test/path',
      EXPLORER_MIDNIGHT_NETWORKS: 'preprod,preview',
      EXPLORER_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID: 'secret token',
      EXPLORER_MIDNIGHT_PREPROD_SIGNER_CONTRACT_ADDRESS: '0xsecretaddress',
      EXPLORER_MIDNIGHT_PREVIEW_INDEXER_URL: 'ftp://secret-indexer?key=secretkey',
      EXPLORER_MIDNIGHT_PREVIEW_START_BLOCK: '-5secret',
      EXPLORER_POLL_INTERVAL_SECONDS: 'zero',
      EXPLORER_TIP_MARGIN_BLOCKS: 'secret-margin',
      EXPLORER_MAX_RANGE_BLOCKS: '1.5',
    }
    const message = failureOf(invalid)
    const invalidNames = Object.keys(invalid).filter(
      (name) => name !== 'EXPLORER_MIDNIGHT_NETWORKS',
    )
    for (const name of invalidNames) {
      expect(message).toContain(name)
    }
    for (const value of Object.values(invalid)) {
      expect(message).not.toContain(value)
    }
    expect(message).not.toMatch(/secret/u)

    const missing = failureOf({})
    for (const name of [
      'EXPLORER_DATABASE_URL',
      'EXPLORER_CORS_ORIGINS',
      'EXPLORER_MIDNIGHT_NETWORKS',
    ]) {
      expect(missing).toContain(`${name} is required`)
    }
  })

  it("builds preview's and preprod's sources from a Blockfrost project id", () => {
    const [preprod, preview] = parseBackendEnv({
      ...MINIMAL_PREPROD_ENV,
      EXPLORER_MIDNIGHT_NETWORKS: 'preprod,preview',
      EXPLORER_MIDNIGHT_PREVIEW_BLOCKFROST_PROJECT_ID: 'previewAb+1/',
    }).networks
    expect(preprod?.config.sourceUrl).toBe(
      'https://midnight-preprod.blockfrost.io/api/v0?project_id=preprodAb%2B1%2F',
    )
    expect(preview?.config.sourceUrl).toBe(
      'https://midnight-preview.blockfrost.io/api/v0?project_id=previewAb%2B1%2F',
    )
    expect(
      failureOf({
        ...MINIMAL_PREPROD_ENV,
        EXPLORER_MIDNIGHT_PREPROD_INDEXER_URL: 'https://indexer.test/graphql',
      }),
    ).toContain(
      'set exactly one of EXPLORER_MIDNIGHT_PREPROD_INDEXER_URL and EXPLORER_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID',
    )
  })

  it("takes the SDK's addresses and their deployment block by default", () => {
    const config = parseBackendEnv({
      ...MINIMAL_PREPROD_ENV,
      EXPLORER_MIDNIGHT_NETWORKS: 'preprod,preview',
      EXPLORER_MIDNIGHT_PREVIEW_INDEXER_URL: 'https://indexer.preview.test/graphql',
    })
    const [preprod, preview] = config.networks
    expect(preprod?.config).toMatchObject({
      signerContractAddress: getSignerContractAddress(MidnightNetwork.Preprod),
      responderContractAddress: getResponderContractAddress(MidnightNetwork.Preprod),
      startBlock: 3_386_746,
    })
    expect(preview?.config).toMatchObject({
      signerContractAddress: getSignerContractAddress(MidnightNetwork.Preview),
      responderContractAddress: getResponderContractAddress(MidnightNetwork.Preview),
      startBlock: 44_831,
    })
    expect(
      failureOf({
        ...MINIMAL_PREPROD_ENV,
        EXPLORER_MIDNIGHT_NETWORKS: 'preview',
        EXPLORER_MIDNIGHT_PREVIEW_INDEXER_URL: 'https://indexer.preview.test/graphql',
        EXPLORER_MIDNIGHT_PREVIEW_RESPONDER_CONTRACT_ADDRESS: RESPONDER,
      }),
    ).toContain('EXPLORER_MIDNIGHT_PREVIEW_START_BLOCK is required')
    expect(
      failureOf({
        ...MINIMAL_PREPROD_ENV,
        EXPLORER_MIDNIGHT_PREPROD_SIGNER_CONTRACT_ADDRESS: SIGNER,
      }),
    ).toContain('EXPLORER_MIDNIGHT_PREPROD_START_BLOCK is required')
    const mainnet = failureOf({
      ...MINIMAL_PREPROD_ENV,
      EXPLORER_MIDNIGHT_NETWORKS: 'mainnet',
      EXPLORER_MIDNIGHT_MAINNET_INDEXER_URL: 'https://indexer.mainnet.test/graphql',
    })
    expect(mainnet).toContain('EXPLORER_MIDNIGHT_MAINNET_SIGNER_CONTRACT_ADDRESS is required')
    expect(mainnet).toContain('EXPLORER_MIDNIGHT_MAINNET_RESPONDER_CONTRACT_ADDRESS is required')
    expect(mainnet).toContain('EXPLORER_MIDNIGHT_MAINNET_START_BLOCK is required')
  })

  it('takes the poll interval, the tip margin and the range from the decisions by default', () => {
    expect([
      EXPLORER_DEFAULT_POLL_INTERVAL_SECONDS,
      EXPLORER_DEFAULT_TIP_MARGIN_BLOCKS,
      EXPLORER_DEFAULT_MAX_RANGE_BLOCKS,
    ]).toEqual([30, 6, 2_000])
    const config = parseBackendEnv(MINIMAL_PREPROD_ENV)
    expect(config.host).toBe('0.0.0.0')
    expect(config.port).toBe(8080)
    expect(config.networks[0]).toMatchObject({
      pollIntervalSeconds: 30,
      tipMargin: 6,
      maxRange: 2_000,
    })
  })

  it('refuses a network that is not a Midnight network or has no source', () => {
    expect(
      failureOf({ ...MINIMAL_PREPROD_ENV, EXPLORER_MIDNIGHT_NETWORKS: 'preprod,testnet' }),
    ).toContain('EXPLORER_MIDNIGHT_NETWORKS is invalid')
    expect(
      failureOf({ ...MINIMAL_PREPROD_ENV, EXPLORER_MIDNIGHT_NETWORKS: 'preprod,preprod' }),
    ).toContain('EXPLORER_MIDNIGHT_NETWORKS is invalid')
    expect(
      failureOf({ ...MINIMAL_PREPROD_ENV, EXPLORER_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID: '' }),
    ).toContain('set exactly one of EXPLORER_MIDNIGHT_PREPROD_INDEXER_URL and')
    expect(
      failureOf({
        ...MINIMAL_PREPROD_ENV,
        EXPLORER_MIDNIGHT_NETWORKS: 'preview',
      }),
    ).toContain('set exactly one of EXPLORER_MIDNIGHT_PREVIEW_INDEXER_URL and')
    expect(
      failureOf({
        ...MINIMAL_PREPROD_ENV,
        EXPLORER_MIDNIGHT_NETWORKS: 'undeployed',
        EXPLORER_MIDNIGHT_UNDEPLOYED_START_BLOCK: '1',
      }),
    ).toContain('EXPLORER_MIDNIGHT_UNDEPLOYED_INDEXER_URL is required')
  })
})
