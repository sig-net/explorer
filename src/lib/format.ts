function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/** A moment as `DD-MM-YY HH:MM:SS` in UTC. */
export function formatUtcTimestamp(date: Date): string {
  const day = `${twoDigits(date.getUTCDate())}-${twoDigits(date.getUTCMonth() + 1)}-${twoDigits(date.getUTCFullYear() % 100)}`
  const time = `${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())}:${twoDigits(date.getUTCSeconds())}`
  return `${day} ${time}`
}

/** Keeps `edge` characters from each end of a long value: `bea3...345a`. */
export function truncateMiddle(value: string, edge = 4): string {
  return value.length <= edge * 2 + 3 ? value : `${value.slice(0, edge)}...${value.slice(-edge)}`
}

const DURATION_UNITS: readonly { unit: string; ms: number }[] = [
  { unit: 'day', ms: 86_400_000 },
  { unit: 'hour', ms: 3_600_000 },
  { unit: 'minute', ms: 60_000 },
  { unit: 'second', ms: 1000 },
]

/**
 * A duration in its largest whole unit: `45 seconds`, `1 minute`, `3 hours`. A negative duration
 * keeps its sign, since an end before its start is worth seeing.
 */
export function formatDuration(ms: number): string {
  const magnitude = Math.abs(ms)
  const { unit, ms: unitMs } = DURATION_UNITS.find((candidate) => magnitude >= candidate.ms) ?? {
    unit: 'second',
    ms: 1000,
  }
  const count = Math.floor(magnitude / unitMs)
  return `${ms < 0 ? '-' : ''}${String(count)} ${unit}${count === 1 ? '' : 's'}`
}
