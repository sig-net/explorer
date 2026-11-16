import type { SignetContractRole, StoredSignetMiscEvent } from '@sig-net/explorer-lib'

/**
 * Where the ingest reads one Midnight network. Hashes and raw transactions are lower case hex
 * without `0x`. Every method rejects when the source cannot answer.
 */
export interface MidnightSource {
  genesisHash(): Promise<string>
  finalisedTip(): Promise<SourceBlock>
  /** The block at `height`, or null above the finalised tip. */
  blockAt(height: number): Promise<SourceBlockId | null>
  /**
   * Every event the signer and the responder emitted in the blocks of `range`, both ends
   * included, ascending by id.
   */
  eventsIn(range: SourceBlockRange): Promise<SourceSignetEvent[]>
  /** The bytes of the transaction with `hash`. */
  rawTransaction(hash: string): Promise<string>
}

export interface SourceBlockId {
  readonly hash: string
  readonly time: Date
}

export interface SourceBlock extends SourceBlockId {
  readonly height: number
}

export interface SourceBlockRange {
  readonly fromBlock: number
  readonly toBlock: number
}

/** An event as the source served it, with the roles of the contract that emitted it. */
export interface SourceSignetEvent {
  readonly source: StoredSignetMiscEvent
  readonly roles: readonly SignetContractRole[]
}
