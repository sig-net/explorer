import { expect, test } from 'vitest'

import { attestedOutputJson } from './attested-output-json'

test('integers, bytes and arrays become plain JSON', () => {
  expect(
    attestedOutputJson({
      success: true,
      amount: 1_000_000n,
      huge: 2n ** 64n,
      memo: 'paid',
      raw: new Uint8Array([0xde, 0xad]),
      amounts: [1n, 2n],
    }),
  ).toEqual({
    success: true,
    amount: 1_000_000,
    huge: '18446744073709551616',
    memo: 'paid',
    raw: 'dead',
    amounts: [1, 2],
  })
})
