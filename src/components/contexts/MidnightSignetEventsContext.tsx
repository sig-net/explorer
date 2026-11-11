import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'

import { useMidnight } from '@/components/contexts/MidnightContext'
import { parseContractAddressHex } from '@/lib/midnight/contract-address'
import { fetchIndexerBlockHeight } from '@/lib/midnight/indexer-block-height'
import { isIndexerUrlConfigured } from '@/lib/midnight/indexer-services'
import { parseSignetEventsFromBlock, signetEventsEarliestBlock } from '@/lib/midnight/network'
import { SignetEventStore, type SignetEventStoreSnapshot } from '@/lib/midnight/signet-event-store'
import {
  defaultSignetEventsFromBlock,
  signetEventsFromBlockSteppedBack,
} from '@/lib/midnight/signet-events-window'

/** The block both contracts' events are read from, as the configuration resolves it. */
export type SignetStartingBlock =
  /** No indexer URL is configured, so there is no chain tip to read. */
  | { readonly status: 'no-indexer' }
  /** The configured value is not a block height. */
  | { readonly status: 'invalid' }
  /** The chain tip, which the load reads down from, is being read. */
  | { readonly status: 'resolving' }
  /** The chain tip could not be read, and why. */
  | { readonly status: 'unavailable'; readonly error: string }
  | {
      readonly status: 'resolved'
      readonly block: number
      /** True when the block is the default window's start, false for a configured block. */
      readonly automatic: boolean
      /** The lowest block worth reading from: the contracts' listed earliest block, or zero. */
      readonly floor: number
    }

export type MidnightSignetEventsContextValue = SignetEventStoreSnapshot & {
  startingBlock: SignetStartingBlock
  /** True while the starting block is resolved above its floor, so a step back moves it. */
  canStepStartingBlockBack: boolean
  /**
   * Moves the starting block half a day of blocks earlier, as a configured value, and reads the
   * added blocks. False when it is resolved at its floor, or not resolved.
   */
  stepStartingBlockBack: () => boolean
  /** Re-reads the chain tip, which reloads the range up to the new tip. */
  refresh: () => void
}

const MidnightSignetEventsContext = createContext<MidnightSignetEventsContextValue | null>(null)

/** The chain tip of one indexer, or why it could not be read, from one numbered read. */
interface IndexerTip {
  readonly indexerUrl: string
  readonly read: number
  readonly result: { readonly height: number } | { readonly error: string }
}

/**
 * Loads the signer's and the responder's events once the indexer services exist and the selected
 * network names both addresses and a starting block, and keeps every completed load for the life
 * of the application.
 */
export function MidnightSignetEventsProvider({ children }: { children: ReactNode }) {
  const { indexerServices, config, setConfig } = useMidnight()
  const { indexerUrl } = config
  const indexerConfigured = isIndexerUrlConfigured(indexerUrl)
  // The configuration holds the addresses and block as typed. The canonical forms key the cache, so
  // a `0x` prefix or upper case names the same contract, and a half-typed value starts no load.
  const signerContractAddress = parseContractAddressHex(config.signerContractAddress)
  const responderContractAddress = parseContractAddressHex(config.responderContractAddress)
  const configuredBlock = parseSignetEventsFromBlock(config.signetEventsFromBlock)
  const eventSource = indexerServices?.signetEventSource ?? null
  const [store] = useState(() => new SignetEventStore())
  const [tip, setTip] = useState<IndexerTip | null>(null)

  // Every load reads down from the tip, which is read once per indexer and again on refresh: a
  // tip that moved with the chain would reload the events on every render.
  const [tipReads, setTipReads] = useState(0)
  useEffect(() => {
    let current = true
    if (indexerConfigured) {
      fetchIndexerBlockHeight(indexerUrl).then(
        (height) => {
          if (current) {
            setTip({ indexerUrl, read: tipReads, result: { height } })
          }
        },
        (error: unknown) => {
          if (current) {
            const message = error instanceof Error ? error.message : String(error)
            setTip({ indexerUrl, read: tipReads, result: { error: message } })
          }
        },
      )
    }
    return () => {
      current = false
    }
  }, [indexerUrl, indexerConfigured, tipReads])
  const tipIsCurrent = tip?.indexerUrl === indexerUrl

  const floor =
    signerContractAddress === null || responderContractAddress === null
      ? 0
      : (signetEventsEarliestBlock(signerContractAddress, responderContractAddress) ?? 0)
  const startingBlock = ((): SignetStartingBlock => {
    if (!indexerConfigured) {
      return { status: 'no-indexer' }
    }
    if (configuredBlock === null) {
      return { status: 'invalid' }
    }
    if (tip === null || !tipIsCurrent) {
      return { status: 'resolving' }
    }
    if ('error' in tip.result) {
      return { status: 'unavailable', error: tip.result.error }
    }
    if (configuredBlock.fromBlock !== null) {
      return { status: 'resolved', block: configuredBlock.fromBlock, automatic: false, floor }
    }
    return {
      status: 'resolved',
      block: defaultSignetEventsFromBlock(tip.result.height, floor),
      automatic: true,
      floor,
    }
  })()
  const fromBlock = startingBlock.status === 'resolved' ? startingBlock.block : null
  const tipHeight =
    tip !== null && tipIsCurrent && 'height' in tip.result ? tip.result.height : null

  // The store holds no connection of its own (MidnightProvider owns and disposes the provider),
  // so the effect needs no cleanup: a repeated run with the same arguments keeps the in-flight
  // load.
  useEffect(() => {
    if (
      eventSource === null ||
      signerContractAddress === null ||
      responderContractAddress === null ||
      fromBlock === null ||
      tipHeight === null
    ) {
      store.deselect()
    } else {
      store.select(
        { indexerUrl, signerContractAddress, responderContractAddress },
        eventSource,
        fromBlock,
        tipHeight,
      )
    }
  }, [
    store,
    eventSource,
    indexerUrl,
    signerContractAddress,
    responderContractAddress,
    fromBlock,
    tipHeight,
  ])

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)

  // The block a step back moves to: null at the floor, or while the block is not resolved.
  const steppedBackBlock =
    startingBlock.status === 'resolved' && startingBlock.block > startingBlock.floor
      ? Math.max(startingBlock.floor, signetEventsFromBlockSteppedBack(startingBlock.block))
      : null

  const value: MidnightSignetEventsContextValue = {
    ...snapshot,
    startingBlock,
    canStepStartingBlockBack: steppedBackBlock !== null,
    stepStartingBlockBack: () => {
      if (steppedBackBlock === null) {
        return false
      }
      setConfig({ signetEventsFromBlock: String(steppedBackBlock) })
      return true
    },
    refresh: () => {
      setTipReads((reads) => reads + 1)
    },
  }

  return <MidnightSignetEventsContext value={value}>{children}</MidnightSignetEventsContext>
}

export function useMidnightSignetEvents(): MidnightSignetEventsContextValue {
  const context = useContext(MidnightSignetEventsContext)
  if (context === null) {
    throw new Error('useMidnightSignetEvents must be used within a MidnightSignetEventsProvider')
  }
  return context
}
