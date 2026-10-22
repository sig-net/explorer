import { expect, test } from 'vitest'

import {
  defaultSignetEventsFromBlock,
  MIDNIGHT_BLOCKS_PER_DAY,
  midnightBlocksIn,
  signetEventsFromBlockSteppedBack,
} from './signet-events-window'

test('a day of stagenet blocks follows from the block time', () => {
  expect(MIDNIGHT_BLOCKS_PER_DAY).toBe(12343)
  expect(midnightBlocksIn(2)).toBe(24686)
  expect(midnightBlocksIn(0.5)).toBe(6172)
})

test('the default starting block is two days before the tip, floored by the listed block and zero', () => {
  expect(defaultSignetEventsFromBlock(973415, null)).toBe(973415 - 24686)
  expect(defaultSignetEventsFromBlock(973415, 900000)).toBe(973415 - 24686)
  expect(defaultSignetEventsFromBlock(973415, 970000)).toBe(970000)
  expect(defaultSignetEventsFromBlock(1000, null)).toBe(0)
})

test('a step back reads from half a day earlier, never below zero', () => {
  expect(signetEventsFromBlockSteppedBack(100000)).toBe(100000 - 6172)
  expect(signetEventsFromBlockSteppedBack(100)).toBe(0)
})
