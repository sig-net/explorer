/**
 * Stagenet's block time in seconds: 7.0 over the 100,000 blocks before block 973415, read off the
 * indexer on 2026-10-22.
 */
export const MIDNIGHT_SECONDS_PER_BLOCK = 7

export const MIDNIGHT_BLOCKS_PER_DAY = Math.round((24 * 60 * 60) / MIDNIGHT_SECONDS_PER_BLOCK)

/** How far before the chain tip the explorer starts reading events by default, in days. */
export const DEFAULT_SIGNET_EVENTS_WINDOW_DAYS = 2

/** How much earlier one step back of the starting block reads from, in days. */
export const SIGNET_EVENTS_STEP_BACK_DAYS = 0.5

/**
 * The span of blocks one indexer read covers, in days: a window is read in slices of this size,
 * newest first, so the latest requests show before the rest of the window arrives.
 */
export const SIGNET_EVENTS_SLICE_DAYS = 1 / 8

/** The number of blocks `days` of stagenet blocks take. */
export function midnightBlocksIn(days: number): number {
  return Math.round(days * MIDNIGHT_BLOCKS_PER_DAY)
}

/**
 * The starting block for a chain whose tip is `tipHeight`: the default window of blocks before
 * the tip, never below `earliestBlock` where one is listed, and never below zero.
 */
export function defaultSignetEventsFromBlock(
  tipHeight: number,
  earliestBlock: number | null,
): number {
  const windowStart = tipHeight - midnightBlocksIn(DEFAULT_SIGNET_EVENTS_WINDOW_DAYS)
  return Math.max(0, earliestBlock ?? 0, windowStart)
}

/** `fromBlock` moved one step back, never below zero. */
export function signetEventsFromBlockSteppedBack(fromBlock: number): number {
  return Math.max(0, fromBlock - midnightBlocksIn(SIGNET_EVENTS_STEP_BACK_DAYS))
}
