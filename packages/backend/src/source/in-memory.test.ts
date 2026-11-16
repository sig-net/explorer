import type { SignetContractEvent } from '@sig-net/explorer-lib'
import { notificationEvent, responseEvent } from '@sig-net/explorer-lib/testing'
import { SignetEventName } from '@sig-net/midnight'
import { describe, expect, it } from 'vitest'

import { createInMemoryMidnightSource, type InMemoryBlock } from './in-memory.ts'
import type { SourceSignetEvent } from './port.ts'

const GENESIS_HASH = '00'.repeat(32)
const REQUEST_ID = new Uint8Array(32).fill(0xa1)

/** The block the lifecycle fixture puts the event with `id` in, holding `events`. */
function blockOf(id: number, hash: string, events: readonly SourceSignetEvent[]): InMemoryBlock {
  return {
    height: 1000 + id,
    hash,
    time: new Date(Date.UTC(2026, 8, 7, 12, 0, id)),
    events,
    rawTransactions: Object.fromEntries(
      events.map(({ source }) => [source.transactionHash, `aa${source.id.toString(16)}`]),
    ),
  }
}

function sourceEvent(
  { source, roles }: SignetContractEvent,
  blockHash?: string,
): SourceSignetEvent {
  return { source: { ...source, blockHash: blockHash ?? source.blockHash }, roles }
}

function notification(id: number, blockHash?: string): SourceSignetEvent {
  return sourceEvent(
    notificationEvent(id, REQUEST_ID, new Uint8Array(32).fill(0xc0), id),
    blockHash,
  )
}

function signature(id: number): SourceSignetEvent {
  return sourceEvent(responseEvent(id, SignetEventName.SignatureRespondedEvent, REQUEST_ID, id))
}

const FIXTURE_BLOCK_HASH = 'c0'.repeat(32)

describe('the in-memory source', () => {
  it('the in-memory source serves a range in emission order', async () => {
    const source = createInMemoryMidnightSource(GENESIS_HASH, [
      blockOf(1, FIXTURE_BLOCK_HASH, [notification(1)]),
      blockOf(2, FIXTURE_BLOCK_HASH, []),
      blockOf(3, FIXTURE_BLOCK_HASH, [signature(3)]),
    ])
    const idsIn = async (fromBlock: number, toBlock: number): Promise<number[]> =>
      (await source.eventsIn({ fromBlock, toBlock })).map((event) => event.source.id)

    expect(await source.genesisHash()).toBe(GENESIS_HASH)
    expect(await source.finalisedTip()).toEqual({
      height: 1003,
      hash: FIXTURE_BLOCK_HASH,
      time: new Date('2026-09-07T12:00:03Z'),
    })
    expect(await idsIn(1001, 1003)).toEqual([1, 3])
    expect(await idsIn(1002, 1003)).toEqual([3])
    expect(await idsIn(1001, 1001)).toEqual([1])
    expect(await source.blockAt(1004)).toBeNull()
    expect(await source.rawTransaction(notification(1).source.transactionHash)).toBe('aa1')
  })

  it('serves a block a test appends', async () => {
    const source = createInMemoryMidnightSource(GENESIS_HASH, [blockOf(1, FIXTURE_BLOCK_HASH, [])])

    source.appendBlock(blockOf(2, FIXTURE_BLOCK_HASH, [signature(2)]))

    expect((await source.finalisedTip()).height).toBe(1002)
    expect(await source.eventsIn({ fromBlock: 1001, toBlock: 1002 })).toEqual([signature(2)])
    expect(() => {
      source.appendBlock(blockOf(4, FIXTURE_BLOCK_HASH, []))
    }).toThrow('does not follow the tip')
  })

  it('fails the next call alone', async () => {
    const source = createInMemoryMidnightSource(GENESIS_HASH, [blockOf(1, FIXTURE_BLOCK_HASH, [])])

    source.failNextCall(new Error('the indexer is away'))

    await expect(source.finalisedTip()).rejects.toThrow('the indexer is away')
    expect((await source.finalisedTip()).height).toBe(1001)
  })

  it('serves the block a test put in the place of another', async () => {
    const replacedHash = 'd1'.repeat(32)
    const source = createInMemoryMidnightSource(GENESIS_HASH, [
      blockOf(1, FIXTURE_BLOCK_HASH, [notification(1)]),
      blockOf(2, FIXTURE_BLOCK_HASH, []),
    ])

    source.replaceBlock(blockOf(1, replacedHash, [notification(1, replacedHash)]))

    expect((await source.blockAt(1001))?.hash).toBe(replacedHash)
    expect(await source.eventsIn({ fromBlock: 1001, toBlock: 1002 })).toEqual([
      notification(1, replacedHash),
    ])
    expect(() => {
      source.replaceBlock(blockOf(1, replacedHash, [notification(1)]))
    }).toThrow('names block')
  })
})
