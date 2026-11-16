import type { MidnightSource, SourceBlock, SourceSignetEvent } from './port.ts'

/** A {@link MidnightSource} over a chain a test builds and changes. */
export interface InMemoryMidnightSource extends MidnightSource {
  /** Makes `block` the new tip. Its height is the tip's plus one. */
  appendBlock(block: InMemoryBlock): void
  /** Puts `block` in the place of the block at its height. */
  replaceBlock(block: InMemoryBlock): void
  /** Makes the next call of any source method reject with `error`. The call after it answers. */
  failNextCall(error: Error): void
}

/** A block with the events both contracts emitted in it and the transactions that emitted them. */
export interface InMemoryBlock extends SourceBlock {
  readonly events: readonly SourceSignetEvent[]
  /** Raw transactions as hex, by transaction hash. */
  readonly rawTransactions: Readonly<Record<string, string>>
}

/**
 * @throws {Error} When `blocks` is empty or its heights do not ascend one by one, or when an event
 *   names another block than the one that holds it.
 */
export function createInMemoryMidnightSource(
  genesisHash: string,
  blocks: readonly InMemoryBlock[],
): InMemoryMidnightSource {
  const chain: InMemoryBlock[] = []
  let failure: Error | null = null

  const tip = (): InMemoryBlock => {
    const block = chain.at(-1)
    if (block === undefined) {
      throw new Error('the in-memory source holds no block')
    }
    return block
  }
  const indexOf = (height: number): number => height - (chain[0]?.height ?? height)
  const append = (block: InMemoryBlock): void => {
    const expected = chain.length === 0 ? block.height : tip().height + 1
    if (block.height !== expected) {
      throw new Error(`block ${String(block.height)} does not follow the tip: ${String(expected)}`)
    }
    chain.push(checkedBlock(block))
  }
  const answer = <T>(read: () => T): Promise<T> => {
    if (failure !== null) {
      const error = failure
      failure = null
      return Promise.reject(error)
    }
    try {
      return Promise.resolve(read())
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)))
    }
  }

  for (const block of blocks) {
    append(block)
  }
  tip()

  return {
    genesisHash: () => answer(() => genesisHash),
    finalisedTip: () =>
      answer(() => {
        const { height, hash, time } = tip()
        return { height, hash, time }
      }),
    blockAt: (height) =>
      answer(() => {
        if (height > tip().height) {
          return null
        }
        const block = chain[indexOf(height)]
        if (block === undefined) {
          throw new Error(`the in-memory source holds no block ${String(height)}`)
        }
        return { hash: block.hash, time: block.time }
      }),
    eventsIn: ({ fromBlock, toBlock }) =>
      answer(() =>
        chain
          .filter((block) => block.height >= fromBlock && block.height <= toBlock)
          .flatMap((block) => block.events)
          .sort((a, b) => a.source.id - b.source.id),
      ),
    rawTransaction: (hash) =>
      answer(() => {
        for (const block of chain) {
          const raw = block.rawTransactions[hash]
          if (raw !== undefined) {
            return raw
          }
        }
        throw new Error(`the in-memory source holds no transaction ${hash}`)
      }),
    appendBlock: append,
    replaceBlock(block: InMemoryBlock): void {
      const index = indexOf(block.height)
      if (chain[index] === undefined) {
        throw new Error(`the in-memory source holds no block ${String(block.height)} to replace`)
      }
      chain[index] = checkedBlock(block)
    },
    failNextCall(error: Error): void {
      failure = error
    },
  }
}

function checkedBlock(block: InMemoryBlock): InMemoryBlock {
  for (const { source } of block.events) {
    if (source.blockHeight !== block.height || source.blockHash !== block.hash) {
      throw new Error(
        `event ${String(source.id)} names block ${String(source.blockHeight)} ${source.blockHash}, and block ${String(block.height)} ${block.hash} holds it`,
      )
    }
  }
  return block
}
