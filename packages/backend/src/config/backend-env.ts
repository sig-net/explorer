import type { ExplorerNetworkConfig } from '@sig-net/explorer-api'
import { isMidnightNetwork, parseContractAddressHex } from '@sig-net/explorer-lib'
import {
  type DeployedNetwork,
  getResponderContractAddress,
  getSignerContractAddress,
  MidnightNetwork,
} from '@sig-net/midnight'
import { z } from 'zod'

/**
 * The backend's configuration, read from `env` and frozen.
 *
 * @throws {Error} Naming every variable that is missing or invalid, and holding none of the values.
 */
export function parseBackendEnv(env: BackendEnv): BackendConfig {
  const reader = new EnvReader(env)
  const databaseUrl = reader.required('EXPLORER_DATABASE_URL', databaseUrlSchema)
  const host = reader.optional('EXPLORER_HOST', hostSchema) ?? EXPLORER_DEFAULT_HOST
  const port = reader.optional('EXPLORER_PORT', portSchema) ?? EXPLORER_DEFAULT_PORT
  const corsOrigins = reader.required('EXPLORER_CORS_ORIGINS', corsOriginsSchema)
  const pollIntervalSeconds =
    reader.optional('EXPLORER_POLL_INTERVAL_SECONDS', positiveIntegerSchema) ??
    EXPLORER_DEFAULT_POLL_INTERVAL_SECONDS
  const tipMargin =
    reader.optional('EXPLORER_TIP_MARGIN_BLOCKS', blockCountSchema) ??
    EXPLORER_DEFAULT_TIP_MARGIN_BLOCKS
  const maxRange =
    reader.optional('EXPLORER_MAX_RANGE_BLOCKS', positiveIntegerSchema) ??
    EXPLORER_DEFAULT_MAX_RANGE_BLOCKS
  const networks = (reader.required('EXPLORER_MIDNIGHT_NETWORKS', networksSchema) ?? []).map(
    (network) => readNetwork(reader, network, { pollIntervalSeconds, tipMargin, maxRange }),
  )
  if (
    reader.problems.length > 0 ||
    databaseUrl === undefined ||
    corsOrigins === undefined ||
    networks.length === 0
  ) {
    throw new Error(`the environment is not a valid configuration:\n${reader.problems.join('\n')}`)
  }
  const served: BackendNetworkConfig[] = []
  for (const network of networks) {
    if (network !== undefined) {
      served.push(Object.freeze({ ...network, config: Object.freeze(network.config) }))
    }
  }
  return Object.freeze({
    databaseUrl,
    host,
    port,
    corsOrigins: corsOrigins === '*' ? corsOrigins : Object.freeze(corsOrigins),
    networks: Object.freeze(served),
  })
}

export type BackendEnv = Readonly<Record<string, string | undefined>>

export interface BackendConfig {
  readonly databaseUrl: string
  /** The address the server listens on. */
  readonly host: string
  readonly port: number
  readonly corsOrigins: CorsOrigins
  /** In the order `EXPLORER_MIDNIGHT_NETWORKS` lists them. */
  readonly networks: readonly BackendNetworkConfig[]
}

/** Every origin, or the exact origins (`scheme://host[:port]`) a browser may call from. */
export type CorsOrigins = '*' | readonly string[]

export interface BackendNetworkConfig extends IngestTiming {
  readonly network: MidnightNetwork
  readonly config: ExplorerNetworkConfig
}

interface IngestTiming {
  readonly pollIntervalSeconds: number
  /** How many blocks below the source's finalised tip the cursor stays. */
  readonly tipMargin: number
  /** The most blocks one cycle reads. */
  readonly maxRange: number
}

export const EXPLORER_DEFAULT_HOST = '0.0.0.0'

export const EXPLORER_DEFAULT_PORT = 8080

export const EXPLORER_DEFAULT_POLL_INTERVAL_SECONDS = 30

export const EXPLORER_DEFAULT_TIP_MARGIN_BLOCKS = 6

export const EXPLORER_DEFAULT_MAX_RANGE_BLOCKS = 2_000

/** Preprod's Blockfrost indexer, which takes a project id as `?project_id=<id>`. */
const PREPROD_BLOCKFROST_INDEXER_URL = 'https://midnight-preprod.blockfrost.io/api/v0'

/** The lower deployment block of the signer and the responder the SDK publishes for preprod. */
const PREPROD_PUBLISHED_CONTRACTS_START_BLOCK = 3_386_746

/** A schema of one variable, and what it expects, which is all an error says about the value. */
interface EnvSchema<T> {
  readonly schema: z.ZodType<T, string>
  readonly expected: string
}

const decimalInteger = (minimum: number, maximum: number): z.ZodType<number, string> =>
  z
    .string()
    .regex(/^\d{1,15}$/u)
    .transform(Number)
    .pipe(z.number().int().min(minimum).max(maximum))

const urlWithProtocols = (protocols: readonly string[]): z.ZodType<string, string> =>
  z.string().refine((value) => URL.canParse(value) && protocols.includes(new URL(value).protocol))

const databaseUrlSchema: EnvSchema<string> = {
  schema: urlWithProtocols(['postgres:', 'postgresql:']),
  expected: 'a postgres:// or postgresql:// connection URL',
}

const hostSchema: EnvSchema<string> = {
  schema: z.string().regex(/^\S+$/u),
  expected: 'a host name or an IP address without whitespace',
}

const portSchema: EnvSchema<number> = {
  schema: decimalInteger(1, 65_535),
  expected: 'a TCP port from 1 to 65535',
}

const positiveIntegerSchema: EnvSchema<number> = {
  schema: decimalInteger(1, Number.MAX_SAFE_INTEGER),
  expected: 'a whole number above 0',
}

const blockCountSchema: EnvSchema<number> = {
  schema: decimalInteger(0, Number.MAX_SAFE_INTEGER),
  expected: 'a whole number of blocks',
}

const indexerUrlSchema: EnvSchema<string> = {
  schema: urlWithProtocols(['http:', 'https:']),
  expected: "an http:// or https:// URL of the indexer's GraphQL endpoint",
}

const blockfrostProjectIdSchema: EnvSchema<string> = {
  schema: z.string().regex(/^\S+$/u),
  expected: 'a Blockfrost project id without whitespace',
}

const contractAddressSchema: EnvSchema<string> = {
  schema: z.string().transform((value, context) => {
    const address = parseContractAddressHex(value)
    if (address === null) {
      context.addIssue({ code: 'custom', message: 'not a contract address' })
      return z.NEVER
    }
    return address
  }),
  expected: '32 bytes of hex, with or without 0x',
}

const corsOriginsSchema: EnvSchema<CorsOrigins> = {
  schema: z.union([
    z.literal('*'),
    z
      .string()
      .transform((value) => value.split(',').map((origin) => origin.trim()))
      .pipe(
        z.array(
          z
            .string()
            .refine(
              (origin) =>
                URL.canParse(origin) &&
                ['http:', 'https:'].includes(new URL(origin).protocol) &&
                new URL(origin).origin === origin,
            ),
        ),
      ),
  ]),
  expected: '* alone, or comma separated origins such as https://example.org',
}

const networksSchema: EnvSchema<readonly MidnightNetwork[]> = {
  schema: z
    .string()
    .transform((value) => value.split(',').map((network) => network.trim()))
    .pipe(
      z
        .array(z.string().refine(isMidnightNetwork))
        .refine((networks) => new Set(networks).size === networks.length),
    )
    .transform((networks) => networks.filter(isMidnightNetwork)),
  expected: `comma separated distinct network ids among ${Object.values(MidnightNetwork).join(', ')}`,
}

/** Reads variables and records every failure without its value. */
class EnvReader {
  readonly problems: string[] = []
  readonly #env: BackendEnv

  constructor(env: BackendEnv) {
    this.#env = env
  }

  /** The value of `name`, undefined when it is unset or empty, or invalid and recorded. */
  optional<T>(name: string, { schema, expected }: EnvSchema<T>): T | undefined {
    const value = this.#env[name]
    if (value === undefined || value === '') {
      return undefined
    }
    const parsed = schema.safeParse(value)
    if (!parsed.success) {
      this.problems.push(`${name} is invalid: expected ${expected}`)
      return undefined
    }
    return parsed.data
  }

  /** The value of `name`, or undefined with its absence or invalidity recorded. */
  required<T>(name: string, envSchema: EnvSchema<T>): T | undefined {
    if (this.isUnset(name)) {
      this.problems.push(`${name} is required: expected ${envSchema.expected}`)
      return undefined
    }
    return this.optional(name, envSchema)
  }

  isUnset(name: string): boolean {
    const value = this.#env[name]
    return value === undefined || value === ''
  }
}

function readNetwork(
  reader: EnvReader,
  network: MidnightNetwork,
  timing: IngestTiming,
): BackendNetworkConfig | undefined {
  const prefix = `EXPLORER_MIDNIGHT_${network.toUpperCase()}`
  const sourceUrl = readSourceUrl(reader, network, prefix)
  const signerContractAddress = readContractAddress(
    reader,
    `${prefix}_SIGNER_CONTRACT_ADDRESS`,
    network,
    getSignerContractAddress,
  )
  const responderContractAddress = readContractAddress(
    reader,
    `${prefix}_RESPONDER_CONTRACT_ADDRESS`,
    network,
    getResponderContractAddress,
  )
  const startBlockName = `${prefix}_START_BLOCK`
  const startBlock =
    reader.optional(startBlockName, blockCountSchema) ??
    (reader.isUnset(startBlockName) &&
    signerContractAddress !== undefined &&
    responderContractAddress !== undefined
      ? publishedStartBlock(network, signerContractAddress, responderContractAddress)
      : undefined)
  if (startBlock === undefined && reader.isUnset(startBlockName)) {
    reader.problems.push(
      `${startBlockName} is required: expected ${blockCountSchema.expected}, as the network's contracts have no known deployment block`,
    )
  }
  if (
    sourceUrl === undefined ||
    signerContractAddress === undefined ||
    responderContractAddress === undefined ||
    startBlock === undefined
  ) {
    return undefined
  }
  return {
    network,
    config: { signerContractAddress, responderContractAddress, startBlock, sourceUrl },
    ...timing,
  }
}

function readSourceUrl(
  reader: EnvReader,
  network: MidnightNetwork,
  prefix: string,
): string | undefined {
  const indexerUrlName = `${prefix}_INDEXER_URL`
  if (network !== MidnightNetwork.Preprod) {
    return reader.required(indexerUrlName, indexerUrlSchema)
  }
  const projectIdName = `${prefix}_BLOCKFROST_PROJECT_ID`
  if (reader.isUnset(indexerUrlName) === reader.isUnset(projectIdName)) {
    reader.problems.push(`set exactly one of ${indexerUrlName} and ${projectIdName}`)
    return undefined
  }
  const projectId = reader.optional(projectIdName, blockfrostProjectIdSchema)
  return projectId === undefined
    ? reader.optional(indexerUrlName, indexerUrlSchema)
    : `${PREPROD_BLOCKFROST_INDEXER_URL}?project_id=${encodeURIComponent(projectId)}`
}

function readContractAddress(
  reader: EnvReader,
  name: string,
  network: MidnightNetwork,
  published: (network: DeployedNetwork) => string,
): string | undefined {
  if (!reader.isUnset(name)) {
    return reader.optional(name, contractAddressSchema)
  }
  try {
    if (network !== MidnightNetwork.Undeployed) {
      return published(network)
    }
  } catch {
    // The SDK throws for a deployed network it publishes no address for yet.
  }
  reader.problems.push(
    `${name} is required: expected ${contractAddressSchema.expected}, as the SDK publishes no address for the network`,
  )
  return undefined
}

function publishedStartBlock(
  network: MidnightNetwork,
  signerContractAddress: string,
  responderContractAddress: string,
): number | undefined {
  return network === MidnightNetwork.Preprod &&
    signerContractAddress === getSignerContractAddress(MidnightNetwork.Preprod) &&
    responderContractAddress === getResponderContractAddress(MidnightNetwork.Preprod)
    ? PREPROD_PUBLISHED_CONTRACTS_START_BLOCK
    : undefined
}
