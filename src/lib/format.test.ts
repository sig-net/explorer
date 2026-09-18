import { DateTime, Duration, type DurationLikeObject } from 'luxon'
import { expect, test } from 'vitest'

import { formatDuration, formatLocalTimestamp, truncateMiddle } from './format'

// The test browser runs in Asia/Kolkata (UTC+05:30, no daylight saving), set in vite.config.ts.
test('a timestamp renders as DD-MM-YY HH:MM:SS in the local time zone', () => {
  expect(formatLocalTimestamp(DateTime.fromISO('2026-09-07T03:04:05Z').toJSDate())).toBe(
    '07-09-26 08:34:05',
  )
  expect(formatLocalTimestamp(DateTime.fromISO('2026-12-31T23:59:59+02:00').toJSDate())).toBe(
    '01-01-27 03:29:59',
  )
})

test('a timestamp that does not parse renders as a placeholder', () => {
  expect(formatLocalTimestamp(DateTime.invalid('unparsed fixture').toJSDate())).toBe('--')
})

test('a long value keeps four characters from each end', () => {
  expect(truncateMiddle('bea3' + '0'.repeat(56) + '345a')).toBe('bea3...345a')
  expect(truncateMiddle('short')).toBe('short')
  expect(truncateMiddle('abcdefghijk')).toBe('abcdefghijk')
  expect(truncateMiddle('abcdefghijkl')).toBe('abcd...ijkl')
})

function millis(duration: DurationLikeObject): number {
  return Duration.fromObject(duration).toMillis()
}

test('a duration renders in its largest whole unit, rounded down', () => {
  expect(formatDuration(millis({ seconds: 0 }))).toBe('0 seconds')
  expect(formatDuration(millis({ seconds: 1 }))).toBe('1 second')
  expect(formatDuration(millis({ seconds: 59, milliseconds: 999 }))).toBe('59 seconds')
  expect(formatDuration(millis({ minutes: 1 }))).toBe('1 minute')
  expect(formatDuration(millis({ hours: 2, minutes: 1 }))).toBe('2 hours')
  expect(formatDuration(millis({ days: 3 }))).toBe('3 days')
  expect(formatDuration(millis({ minutes: -2 }))).toBe('-2 minutes')
})

test('a duration that is not a finite count renders as a placeholder', () => {
  expect(formatDuration(Number.NaN)).toBe('--')
  expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('--')
})
