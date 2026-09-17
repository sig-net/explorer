import { expect, test } from 'vitest'

import { formatDuration, formatUtcTimestamp, truncateMiddle } from './format'

test('a timestamp renders as DD-MM-YY HH:MM:SS in UTC', () => {
  expect(formatUtcTimestamp(new Date(Date.UTC(2026, 8, 7, 3, 4, 5)))).toBe('07-09-26 03:04:05')
  expect(formatUtcTimestamp(new Date('2026-12-31T23:59:59+02:00'))).toBe('31-12-26 21:59:59')
})

test('a long value keeps four characters from each end', () => {
  expect(truncateMiddle('bea3' + '0'.repeat(56) + '345a')).toBe('bea3...345a')
  expect(truncateMiddle('short')).toBe('short')
  expect(truncateMiddle('abcdefghijk')).toBe('abcdefghijk')
  expect(truncateMiddle('abcdefghijkl')).toBe('abcd...ijkl')
})

test('a duration renders in its largest whole unit', () => {
  expect(formatDuration(0)).toBe('0 seconds')
  expect(formatDuration(1000)).toBe('1 second')
  expect(formatDuration(59_999)).toBe('59 seconds')
  expect(formatDuration(60_000)).toBe('1 minute')
  expect(formatDuration(7_260_000)).toBe('2 hours')
  expect(formatDuration(3 * 86_400_000)).toBe('3 days')
  expect(formatDuration(-120_000)).toBe('-2 minutes')
})
