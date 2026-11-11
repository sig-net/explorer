import { expect, test } from 'vitest'

import {
  defaultSignetEventsFromBlock,
  MIDNIGHT_BLOCKS_PER_DAY,
  midnightBlocksIn,
  signetEventsFromBlockSteppedBack,
} from './signet-events-window'

test('a day of Midnight blocks follows from the block time', () => {
  expect(MIDNIGHT_BLOCKS_PER_DAY).toBe(14400)
  expect(midnightBlocksIn(2)).toBe(28800)
  expect(midnightBlocksIn(0.5)).toBe(7200)
})

test('the default starting block is two days before the tip, floored by the listed block and zero', () => {
  expect(defaultSignetEventsFromBlock(3375000, null)).toBe(3375000 - 28800)
  expect(defaultSignetEventsFromBlock(3375000, 3300000)).toBe(3375000 - 28800)
  expect(defaultSignetEventsFromBlock(3375000, 3370000)).toBe(3370000)
  expect(defaultSignetEventsFromBlock(1000, null)).toBe(0)
})

test('a step back reads from half a day earlier, never below zero', () => {
  expect(signetEventsFromBlockSteppedBack(100000)).toBe(100000 - 7200)
  expect(signetEventsFromBlockSteppedBack(100)).toBe(0)
})
