import {
  type IngestCycleDependencies,
  type IngestCycleOutcome,
  type IngestCycleSettings,
  recordedErrorText,
  runIngestCycle,
} from './ingest-cycle.ts'

/**
 * Repeats {@link runIngestCycle} for `settings.network` until `options.signal` aborts. The promise
 * resolves once the cycle in flight has returned, and does not reject.
 */
export async function startIngestLoop(
  deps: IngestCycleDependencies,
  settings: IngestCycleSettings,
  options: IngestLoopOptions,
): Promise<void> {
  const { pollIntervalMs, signal, onOutcome, sleep = sleepUnlessAborted } = options
  let failuresInARow = 0
  while (!signal.aborted) {
    const outcome = await cycleOutcome(deps, settings)
    try {
      onOutcome(outcome)
    } catch {
      // A reporter that throws does not end the loop.
    }
    failuresInARow = outcome.kind === 'failed' ? failuresInARow + 1 : 0
    const wait = waitAfter(outcome, pollIntervalMs, failuresInARow)
    if (wait > 0 && !signal.aborted) {
      try {
        await sleep(wait, signal)
      } catch {
        // A sleep that rejects is a sleep that ended.
      }
    }
  }
}

export interface IngestLoopOptions {
  /** The wait after a cycle that stored nothing. */
  readonly pollIntervalMs: number
  readonly signal: AbortSignal
  /** Called after every cycle. A throw of it is ignored. */
  readonly onOutcome: (outcome: IngestCycleOutcome) => void
  /** Resolves after `ms`, or as soon as `signal` aborts. The default waits on a timer. */
  readonly sleep?: IngestLoopSleep
}

export type IngestLoopSleep = (ms: number, signal: AbortSignal) => Promise<void>

const LONGEST_BACKOFF_MS = 300_000

/** The outcome of one cycle, where a cycle that rejects is a failed one. */
async function cycleOutcome(
  deps: IngestCycleDependencies,
  settings: IngestCycleSettings,
): Promise<IngestCycleOutcome> {
  try {
    return await runIngestCycle(deps, settings)
  } catch (error) {
    return { kind: 'failed', error: recordedErrorText(error) }
  }
}

/** How long the loop waits before the cycle after `outcome`: 0 when there is more to read. */
function waitAfter(
  outcome: IngestCycleOutcome,
  pollIntervalMs: number,
  failuresInARow: number,
): number {
  if (outcome.kind === 'stored') {
    return 0
  }
  return outcome.kind === 'failed'
    ? Math.min(pollIntervalMs * 2 ** failuresInARow, LONGEST_BACKOFF_MS)
    : pollIntervalMs
}

function sleepUnlessAborted(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const wake = (): void => {
      clearTimeout(timer)
      signal.removeEventListener('abort', wake)
      resolve()
    }
    const timer = setTimeout(wake, ms)
    signal.addEventListener('abort', wake)
  })
}
