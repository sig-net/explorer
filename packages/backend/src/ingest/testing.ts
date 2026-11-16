import type { SignetContractEvent } from '@sig-net/explorer-lib'
import { MidnightNetwork } from '@sig-net/midnight'

import {
  createInMemoryMidnightSource,
  type InMemoryBlock,
  type InMemoryMidnightSource,
} from '../source/in-memory.ts'
import type { SourceSignetEvent } from '../source/port.ts'
import type { IngestCycleSettings, InspectTransaction } from './ingest-cycle.ts'

export const GENESIS_HASH = '9e'.repeat(32)
export const FIRST_BLOCK = 1001
export const SETTINGS: IngestCycleSettings = {
  network: MidnightNetwork.Preprod,
  signerContractAddress: 'a0'.repeat(32),
  responderContractAddress: 'b0'.repeat(32),
  startBlock: FIRST_BLOCK,
  maxRange: 100,
  tipMargin: 2,
}

/** An event of the lifecycle fixture, to be emitted in the block at `height`. */
export interface PlacedEvent {
  readonly height: number
  readonly event: SignetContractEvent
  /** The fixture's own hash when omitted: one transaction for each event. */
  readonly transactionHash?: string
}

export function at(
  height: number,
  event: SignetContractEvent,
  transactionHash?: string,
): PlacedEvent {
  return transactionHash === undefined ? { height, event } : { height, event, transactionHash }
}

export function blockHash(height: number, fork = 0): string {
  return `${fork.toString(16).padStart(2, '0')}${height.toString(16).padStart(62, '0')}`
}

export function blockTime(height: number): Date {
  return new Date(Date.UTC(2026, 8, 7, 12, 0, 0) + height * 6000)
}

export function transactionHashOf(placed: PlacedEvent): string {
  return placed.transactionHash ?? placed.event.source.transactionHash
}

export function rawOf(transactionHash: string): string {
  return `aa${transactionHash.slice(-6)}`
}

export function sourceEventOf(placed: PlacedEvent, fork = 0): SourceSignetEvent {
  return {
    roles: placed.event.roles,
    source: {
      ...placed.event.source,
      transactionHash: transactionHashOf(placed),
      blockHeight: placed.height,
      blockHash: blockHash(placed.height, fork),
      blockTimestamp: blockTime(placed.height),
    },
  }
}

/** The block at `height` with the events placed in it, serving every transaction but `withoutRaw`. */
export function blockOf(
  height: number,
  placed: readonly PlacedEvent[],
  fork = 0,
  withoutRaw: readonly string[] = [],
): InMemoryBlock {
  const mine = placed.filter((event) => event.height === height)
  return {
    height,
    hash: blockHash(height, fork),
    time: blockTime(height),
    events: mine.map((event) => sourceEventOf(event, fork)),
    rawTransactions: Object.fromEntries(
      mine
        .map(transactionHashOf)
        .filter((hash) => !withoutRaw.includes(hash))
        .map((hash) => [hash, rawOf(hash)]),
    ),
  }
}

export function chainOf(
  toHeight: number,
  placed: readonly PlacedEvent[],
  withoutRaw: readonly string[] = [],
): InMemoryMidnightSource {
  const blocks: InMemoryBlock[] = []
  for (let height = FIRST_BLOCK; height <= toHeight; height += 1) {
    blocks.push(blockOf(height, placed, 0, withoutRaw))
  }
  return createInMemoryMidnightSource(GENESIS_HASH, blocks)
}

export const inspectedWithoutCells: InspectTransaction = (_raw, notifications) => ({
  callChains: [],
  requests: Object.fromEntries(
    notifications.map(({ source }) => [String(source.id), { cell: null }]),
  ),
})
