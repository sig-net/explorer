import { DateTime, Duration, type DurationLikeObject } from 'luxon'

/** Stands in for a value that cannot be rendered, such as a timestamp that did not parse. */
const UNAVAILABLE = '--'

/**
 * Fixes digits and unit words to Latin numerals and British English, so a device set to another
 * locale still renders the formats these helpers promise.
 */
const DISPLAY_LOCALE = 'en-GB'

/** A moment as `DD-MM-YY HH:MM:SS` in the browser's time zone, or `--` if it does not parse. */
export function formatLocalTimestamp(date: Date): string {
  const moment = DateTime.fromJSDate(date).setLocale(DISPLAY_LOCALE)
  return moment.isValid ? moment.toFormat('dd-MM-yy HH:mm:ss') : UNAVAILABLE
}

/** Keeps `edge` characters from each end of a long value: `bea3...345a`. */
export function truncateMiddle(value: string, edge = 4): string {
  return value.length <= edge * 2 + 3 ? value : `${value.slice(0, edge)}...${value.slice(-edge)}`
}

/** Largest first, so the first unit reaching a whole count is the one to render. */
const DURATION_UNITS = ['days', 'hours', 'minutes', 'seconds'] as const

/**
 * A duration in its largest whole unit: `45 seconds`, `1 minute`, `3 hours`. A negative duration
 * keeps its sign, since an end before its start is worth seeing. A count that is not finite
 * renders as `--`, which also keeps it away from `Duration.fromMillis`, which throws on one.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) {
    return UNAVAILABLE
  }
  const parts = Duration.fromMillis(Math.abs(ms)).shiftTo(...DURATION_UNITS)
  const unit = DURATION_UNITS.find((candidate) => parts.get(candidate) >= 1) ?? 'seconds'
  const whole: DurationLikeObject = { [unit]: Math.floor(parts.get(unit)) }
  return `${ms < 0 ? '-' : ''}${Duration.fromObject(whole, { locale: DISPLAY_LOCALE }).toHuman()}`
}
